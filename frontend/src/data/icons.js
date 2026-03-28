import {
  Footprints, PartyPopper, Handshake, TrendingUp, Swords, Sparkles, Leaf,
  UtensilsCrossed, Music2, Camera, Cake, Gift,
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
};

// Party event type → Lucide icon component. Use Leaf as fallback.
export const EVENT_ICONS = {
  cooking_pot:   UtensilsCrossed,
  dance_floor:   Music2,
  photo_booth:   Camera,
  cake_table:    Cake,
  mystery_chest: Gift,
};
