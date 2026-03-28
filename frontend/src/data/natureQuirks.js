/**
 * Each nature has a small list of personality quirks.
 * One is picked deterministically per dino (based on species hash).
 */
export const NATURE_QUIRKS = {
  Bold: [
    'Charges headfirst into every situation, including the buffet line.',
    'First one on the dance floor, last one to leave.',
    "Won't back down from a staring contest. Ever.",
  ],
  Jolly: [
    'Laughs at every joke, even the bad ones. Especially the bad ones.',
    'Treats every day like a birthday party.',
    "Can't stop smiling. Literally. That's just its face.",
  ],
  Timid: [
    'Hides behind the nearest party guest when startled.',
    'Jumps at the sound of balloon pops.',
    'Prefers to watch the party from a safe distance.',
  ],
  Brave: [
    'Volunteers to pop all the balloons at cleanup.',
    'Will eat any mystery food without hesitation.',
    'Stood its ground when the pinata fell off the string.',
  ],
  Gentle: [
    'Shares its snacks with everyone, even strangers.',
    'Gives the warmest hugs at the party.',
    'Always saves a slice of cake for latecomers.',
  ],
  Quirky: [
    'Eats the cake frosting first and leaves the rest.',
    'Collects napkins from every party it attends.',
    'Insists on wearing its party hat sideways.',
  ],
  Hasty: [
    'Already finished the cake before the candles were blown out.',
    'Runs everywhere. Walking is not an option.',
    'Opens presents before being told it\'s time.',
  ],
  Calm: [
    'Naps through the loud parts of the party.',
    'Completely unphased by chaos. Just vibes.',
    'Could sleep through a fireworks show.',
  ],
  Sassy: [
    'Judges your outfit but won\'t say it to your face.',
    'Has opinions about the playlist and isn\'t afraid to share them.',
    'Gives side-eye to anyone who takes the last cupcake.',
  ],
  Naive: [
    'Thinks every balloon is a new friend.',
    'Tried to eat the confetti. Twice.',
    'Believed someone when they said the pinata would fight back.',
  ],
  Lonely: [
    'Prefers a quiet corner with a good view of the snack table.',
    'Has one best friend and that\'s enough.',
    'Found hanging out with the family dog at every party.',
  ],
  Adamant: [
    'Refuses to share the aux cord.',
    'Will not move from its spot. Not even for cake.',
    'Has strong opinions about party games and won\'t budge.',
  ],
  Naughty: [
    'Keeps stealing decorations when nobody\'s looking.',
    'Hid someone\'s shoes behind the couch. Twice.',
    'Responsible for at least three minor party incidents.',
  ],
  Relaxed: [
    'Found asleep under the snack table after every event.',
    'Moves at its own pace. That pace is slow.',
    'Somehow always finds the comfiest spot in the room.',
  ],
  Modest: [
    'Won musical chairs but pretended it was an accident.',
    'Doesn\'t brag about being everyone\'s favorite.',
    'Quietly the best dancer but would never admit it.',
  ],
};

/** Pick a quirk deterministically based on species string */
export function getQuirk(nature, species) {
  const quirks = NATURE_QUIRKS[nature];
  if (!quirks || quirks.length === 0) return '';
  // Simple hash from species string to pick a consistent index
  let hash = 0;
  for (let i = 0; i < species.length; i++) {
    hash = ((hash << 5) - hash + species.charCodeAt(i)) | 0;
  }
  return quirks[Math.abs(hash) % quirks.length];
}
