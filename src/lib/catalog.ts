// Farbpalette (21 Farben) und Icon-Auswahl (Lucide).
import {
  Activity,
  AlarmClock,
  Apple,
  Ban,
  Bath,
  Bed,
  Bike,
  BookOpen,
  Brain,
  Briefcase,
  Brush,
  Calendar,
  Camera,
  Candy,
  Car,
  Carrot,
  Cat,
  Check,
  Cigarette,
  Clock,
  Code,
  Coffee,
  Droplets,
  Dumbbell,
  Dog,
  Flame,
  Flower2,
  Footprints,
  Gamepad2,
  GlassWater,
  GraduationCap,
  Guitar,
  HandHeart,
  Heart,
  House,
  Languages,
  Laptop,
  Leaf,
  ListChecks,
  Mail,
  Moon,
  Mountain,
  Music,
  Palette,
  Pencil,
  Phone,
  PiggyBank,
  Pill,
  Pizza,
  Plane,
  Salad,
  Scissors,
  Shirt,
  ShoppingCart,
  Smartphone,
  Smile,
  Sparkles,
  Sprout,
  Star,
  Sun,
  Target,
  Timer,
  TreePine,
  Tv,
  Users,
  Wallet,
  Waves,
  Wind,
  Wine,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { onColor } from './palette'

export { COLORS, DEFAULT_COLOR, colorHex, onColor, type HabitColor } from './palette'

export const ICONS: Record<string, { label: string; icon: LucideIcon }> = {
  check: { label: 'Haken', icon: Check },
  dumbbell: { label: 'Training', icon: Dumbbell },
  activity: { label: 'Aktivität', icon: Activity },
  footprints: { label: 'Gehen', icon: Footprints },
  bike: { label: 'Radfahren', icon: Bike },
  waves: { label: 'Schwimmen', icon: Waves },
  mountain: { label: 'Wandern', icon: Mountain },
  droplets: { label: 'Wasser', icon: Droplets },
  'glass-water': { label: 'Glas Wasser', icon: GlassWater },
  coffee: { label: 'Kaffee', icon: Coffee },
  apple: { label: 'Obst', icon: Apple },
  carrot: { label: 'Gemüse', icon: Carrot },
  salad: { label: 'Salat', icon: Salad },
  pizza: { label: 'Pizza', icon: Pizza },
  candy: { label: 'Süßes', icon: Candy },
  wine: { label: 'Alkohol', icon: Wine },
  cigarette: { label: 'Rauchen', icon: Cigarette },
  pill: { label: 'Tabletten', icon: Pill },
  heart: { label: 'Herz', icon: Heart },
  smile: { label: 'Stimmung', icon: Smile },
  brain: { label: 'Kopf', icon: Brain },
  wind: { label: 'Atmen', icon: Wind },
  'hand-heart': { label: 'Dankbarkeit', icon: HandHeart },
  bed: { label: 'Schlaf', icon: Bed },
  moon: { label: 'Abend', icon: Moon },
  sun: { label: 'Morgen', icon: Sun },
  'alarm-clock': { label: 'Aufstehen', icon: AlarmClock },
  bath: { label: 'Duschen', icon: Bath },
  shirt: { label: 'Kleidung', icon: Shirt },
  scissors: { label: 'Pflege', icon: Scissors },
  house: { label: 'Haushalt', icon: House },
  brush: { label: 'Putzen', icon: Brush },
  'shopping-cart': { label: 'Einkaufen', icon: ShoppingCart },
  'book-open': { label: 'Lesen', icon: BookOpen },
  pencil: { label: 'Schreiben', icon: Pencil },
  languages: { label: 'Sprachen', icon: Languages },
  'graduation-cap': { label: 'Lernen', icon: GraduationCap },
  code: { label: 'Programmieren', icon: Code },
  laptop: { label: 'Arbeit am PC', icon: Laptop },
  briefcase: { label: 'Beruf', icon: Briefcase },
  wallet: { label: 'Finanzen', icon: Wallet },
  'piggy-bank': { label: 'Sparen', icon: PiggyBank },
  music: { label: 'Musik', icon: Music },
  guitar: { label: 'Gitarre', icon: Guitar },
  palette: { label: 'Malen', icon: Palette },
  camera: { label: 'Foto', icon: Camera },
  'gamepad-2': { label: 'Gaming', icon: Gamepad2 },
  tv: { label: 'Fernsehen', icon: Tv },
  smartphone: { label: 'Handy', icon: Smartphone },
  phone: { label: 'Anrufen', icon: Phone },
  mail: { label: 'E-Mails', icon: Mail },
  users: { label: 'Freunde', icon: Users },
  dog: { label: 'Hund', icon: Dog },
  cat: { label: 'Katze', icon: Cat },
  sprout: { label: 'Pflanzen', icon: Sprout },
  flower: { label: 'Blumen', icon: Flower2 },
  leaf: { label: 'Natur', icon: Leaf },
  'tree-pine': { label: 'Draußen', icon: TreePine },
  car: { label: 'Auto', icon: Car },
  plane: { label: 'Reisen', icon: Plane },
  target: { label: 'Ziel', icon: Target },
  timer: { label: 'Timer', icon: Timer },
  clock: { label: 'Uhr', icon: Clock },
  calendar: { label: 'Kalender', icon: Calendar },
  'list-checks': { label: 'Aufgaben', icon: ListChecks },
  flame: { label: 'Flamme', icon: Flame },
  zap: { label: 'Energie', icon: Zap },
  star: { label: 'Stern', icon: Star },
  sparkles: { label: 'Glanz', icon: Sparkles },
  ban: { label: 'Verzicht', icon: Ban },
}

export const DEFAULT_ICON = 'check'

export function iconComponent(key: string): LucideIcon {
  return (ICONS[key] ?? ICONS[DEFAULT_ICON]).icon
}

/** Heller Farbton der Gewohnheitsfarbe auf dem Kartenhintergrund (für leere Felder, Icon-Hintergründe). */
export function tint(hex: string, percent: number, base = 'var(--card)'): string {
  return `color-mix(in srgb, ${hex} ${percent}%, ${base})`
}

export interface CellLook {
  background: string
  border: string
  /** Textfarbe für Inhalte (Haken, Zahl) */
  color: string
}

/** Einheitliche Darstellung eines Tagesfelds (Karte, Wochenliste, Tabelle, Kalender). */
export function cellLook(status: 'done' | 'partial' | 'missed' | 'open' | 'neutral' | 'future', hex: string): CellLook {
  switch (status) {
    case 'done':
      return { background: hex, border: 'none', color: onColor(hex) }
    case 'partial':
      return { background: tint(hex, 42), border: 'none', color: 'var(--ink)' }
    case 'neutral':
      return { background: 'transparent', border: `1.5px dashed ${tint(hex, 28)}`, color: 'var(--muted)' }
    case 'future':
      return { background: tint(hex, 5), border: 'none', color: 'var(--muted)' }
    default:
      return { background: tint(hex, 14), border: 'none', color: tint(hex, 70, 'var(--muted)') }
  }
}
