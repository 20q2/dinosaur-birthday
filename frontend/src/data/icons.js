import {
  Footprints, PartyPopper, Handshake, TrendingUp, Swords, Sparkles, Leaf,
  UtensilsCrossed, Music2, Camera, Cake, Gift, Palette, ScrollText,
} from 'lucide-preact';

// Feed entry type → Lucide icon component. Use Leaf as fallback.
export const FEED_ICONS = {
  encounter:   Footprints,
  tamed:       PartyPopper,
  play:        Handshake,
  levelup:     TrendingUp,
  boss:        Swords,
  inspiration: Sparkles,
  partner:     Footprints,
  customize:   Palette,
  note:        ScrollText,
};

// Generic event endpoint → Lucide icon component. Use Leaf as fallback.
export const EVENT_ICONS = {
  event1: UtensilsCrossed,
  event2: Music2,
  event3: Camera,
  event4: Cake,
  event5: Gift,
};
