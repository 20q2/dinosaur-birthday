import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  Stack, StackProps, CfnOutput, Duration, RemovalPolicy,
  aws_dynamodb as dynamodb,
  aws_s3 as s3,
  aws_lambda as lambda,
  aws_apigateway as apigw,
  aws_apigatewayv2 as apigwv2,
  aws_iam as iam,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class DinoPartyStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // ── DynamoDB ────────────────────────────────────────────────

    const gameTable = new dynamodb.Table(this, 'GameTable', {
      tableName: 'dino-party-game',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const connectionsTable = new dynamodb.Table(this, 'ConnectionsTable', {
      tableName: 'dino-party-connections',
      partitionKey: { name: 'connectionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // ── S3 ──────────────────────────────────────────────────────

    const photoBucket = new s3.Bucket(this, 'PhotoBucket', {
      bucketName: `dino-party-photos-${this.account}`,
      lifecycleRules: [{ expiration: Duration.days(7) }],
      cors: [{
        allowedOrigins: ['*'],
        allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT],
        allowedHeaders: ['*'],
      }],
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // ── WebSocket API ───────────────────────────────────────────

    const wsApi = new apigwv2.CfnApi(this, 'WebSocketApi', {
      name: 'dino-party-ws',
      protocolType: 'WEBSOCKET',
      routeSelectionExpression: '$request.body.action',
    });

    const wsStage = new apigwv2.CfnStage(this, 'WebSocketStage', {
      apiId: wsApi.ref,
      stageName: 'prod',
      autoDeploy: true,
    });

    const wsEndpoint = `https://${wsApi.ref}.execute-api.${this.region}.amazonaws.com/prod`;
    const wsManageArn = `arn:aws:execute-api:${this.region}:${this.account}:${wsApi.ref}/*`;

    // ── Shared Lambda props ─────────────────────────────────────

    const backendDir = path.join(__dirname, '..', '..', 'backend');

    const defaultEnv: Record<string, string> = {
      TABLE_NAME: gameTable.tableName,
      CONNECTIONS_TABLE: connectionsTable.tableName,
      WEBSOCKET_ENDPOINT: wsEndpoint,
      S3_BUCKET: photoBucket.bucketName,
    };

    const defaultProps: Partial<lambda.FunctionProps> = {
      runtime: lambda.Runtime.PYTHON_3_12,
      timeout: Duration.seconds(10),
      memorySize: 256,
      code: lambda.Code.fromAsset(backendDir),
      environment: defaultEnv,
    };

    function makeFn(scope: Construct, id: string, handler: string): lambda.Function {
      return new lambda.Function(scope, id, {
        ...defaultProps,
        handler,
      } as lambda.FunctionProps);
    }

    // Helper: grant DynamoDB + WebSocket broadcast permissions
    function grantBroadcast(fn: lambda.Function) {
      gameTable.grantReadWriteData(fn);
      connectionsTable.grantReadWriteData(fn);
      fn.addToRolePolicy(new iam.PolicyStatement({
        actions: ['execute-api:ManageConnections'],
        resources: [wsManageArn],
      }));
    }

    // ── WebSocket Lambda handlers ───────────────────────────────

    const wsConnect = makeFn(this, 'WsConnectFn', 'src.handlers.ws_connect.handler');
    connectionsTable.grantReadWriteData(wsConnect);

    const wsDisconnect = makeFn(this, 'WsDisconnectFn', 'src.handlers.ws_disconnect.handler');
    connectionsTable.grantReadWriteData(wsDisconnect);

    const wsDefault = makeFn(this, 'WsDefaultFn', 'src.handlers.ws_default.handler');
    connectionsTable.grantReadWriteData(wsDefault);
    wsDefault.addToRolePolicy(new iam.PolicyStatement({
      actions: ['execute-api:ManageConnections'],
      resources: [wsManageArn],
    }));

    // Wire up WebSocket routes
    for (const [routeKey, fn] of [
      ['$connect', wsConnect],
      ['$disconnect', wsDisconnect],
      ['$default', wsDefault],
    ] as const) {
      fn.addPermission(`WsPermission-${routeKey}`, {
        principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      });

      const integrationId = `WsInteg${routeKey.replace('$', '')}`;
      const integration = new apigwv2.CfnIntegration(this, integrationId, {
        apiId: wsApi.ref,
        integrationType: 'AWS_PROXY',
        integrationUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${fn.functionArn}/invocations`,
      });

      new apigwv2.CfnRoute(this, `WsRoute${routeKey.replace('$', '')}`, {
        apiId: wsApi.ref,
        routeKey,
        target: `integrations/${integration.ref}`,
      });
    }

    // ── REST API ────────────────────────────────────────────────

    const restApi = new apigw.RestApi(this, 'RestApi', {
      restApiName: 'dino-party',
      deployOptions: { stageName: 'prod' },
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type'],
      },
    });

    // Helper: add a Lambda-backed route to the REST API
    function addRoute(
      fn: lambda.Function,
      method: string,
      resourcePath: string,
    ) {
      const parts = resourcePath.split('/').filter(Boolean);
      let resource = restApi.root;
      for (const part of parts) {
        const existing = resource.getResource(part);
        resource = existing ?? resource.addResource(part);
      }
      resource.addMethod(method, new apigw.LambdaIntegration(fn));
    }

    // ── REST Lambda handlers ────────────────────────────────────

    // Player
    const playerFn = makeFn(this, 'PlayerFn', 'src.handlers.player.handler');
    gameTable.grantReadWriteData(playerFn);
    photoBucket.grantReadWrite(playerFn);
    addRoute(playerFn, 'POST', '/player');
    addRoute(playerFn, 'GET', '/player/{id}');
    addRoute(playerFn, 'PUT', '/player/{id}');

    // Scan Dino
    const scanDinoFn = makeFn(this, 'ScanDinoFn', 'src.handlers.scan_dino.handler');
    grantBroadcast(scanDinoFn);
    addRoute(scanDinoFn, 'POST', '/scan/dino/{species}');

    // Scan Food
    const scanFoodFn = makeFn(this, 'ScanFoodFn', 'src.handlers.scan_food.handler');
    grantBroadcast(scanFoodFn);
    addRoute(scanFoodFn, 'POST', '/scan/food/{type}');

    // Scan Event
    const scanEventFn = makeFn(this, 'ScanEventFn', 'src.handlers.scan_event.handler');
    grantBroadcast(scanEventFn);
    addRoute(scanEventFn, 'POST', '/scan/event/{type}');

    // Scan Inspiration
    const scanInspirationFn = makeFn(this, 'ScanInspirationFn', 'src.handlers.scan_inspiration.handler');
    grantBroadcast(scanInspirationFn);
    addRoute(scanInspirationFn, 'POST', '/scan/inspiration');

    // Scan Note
    const scanNoteFn = makeFn(this, 'ScanNoteFn', 'src.handlers.scan_note.handler');
    gameTable.grantReadWriteData(scanNoteFn);
    addRoute(scanNoteFn, 'POST', '/scan/note/{note_id}');

    // Lobby
    const lobbyFn = makeFn(this, 'LobbyFn', 'src.handlers.lobby.handler');
    grantBroadcast(lobbyFn);
    addRoute(lobbyFn, 'POST', '/lobby');
    addRoute(lobbyFn, 'POST', '/lobby/{code}/join');
    addRoute(lobbyFn, 'POST', '/lobby/{code}/answer');

    // Dino customization
    const dinoFn = makeFn(this, 'DinoFn', 'src.handlers.dino.handler');
    grantBroadcast(dinoFn);
    addRoute(dinoFn, 'PUT', '/dino/{species}/customize');
    addRoute(dinoFn, 'PUT', '/dino/{species}/partner');

    // Boss
    const bossFn = makeFn(this, 'BossFn', 'src.handlers.boss.handler');
    grantBroadcast(bossFn);
    addRoute(bossFn, 'POST', '/boss/tap');

    // Plaza
    const plazaFn = makeFn(this, 'PlazaFn', 'src.handlers.plaza.handler');
    gameTable.grantReadWriteData(plazaFn);
    addRoute(plazaFn, 'GET', '/plaza');

    // Feed
    const feedFn = makeFn(this, 'FeedFn', 'src.handlers.feed.handler');
    gameTable.grantReadWriteData(feedFn);
    addRoute(feedFn, 'GET', '/feed');

    // Admin
    const adminFn = makeFn(this, 'AdminFn', 'src.handlers.admin.handler');
    grantBroadcast(adminFn);
    addRoute(adminFn, 'POST', '/admin/boss/buildup');
    addRoute(adminFn, 'POST', '/admin/boss/start');
    addRoute(adminFn, 'POST', '/admin/announce');
    addRoute(adminFn, 'GET', '/admin/dashboard');
    addRoute(adminFn, 'DELETE', '/admin/reset');
    addRoute(adminFn, 'DELETE', '/admin/reset-all');
    addRoute(adminFn, 'DELETE', '/admin/nuke-all');

    // ── Outputs ─────────────────────────────────────────────────

    new CfnOutput(this, 'RestApiUrl', {
      value: restApi.url,
    });

    new CfnOutput(this, 'WebSocketUrl', {
      value: `wss://${wsApi.ref}.execute-api.${this.region}.amazonaws.com/prod`,
    });

    new CfnOutput(this, 'PhotoBucketName', {
      value: photoBucket.bucketName,
    });
  }
}
