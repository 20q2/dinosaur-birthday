import { App } from 'aws-cdk-lib';
import { DinoPartyStack } from '../lib/dino-party-stack.js';

const app = new App();
new DinoPartyStack(app, 'DinoPartyStack');
