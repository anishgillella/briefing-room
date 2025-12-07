# UI/UX Design System

## Overview

The Briefing Room interface follows a **Mission Control** aesthetic - inspired by space control centers and high-stakes operations rooms. The goal is to make interviewers feel prepared, confident, and in control.

---

## Design Principles

### 1. **Dark Mode First**
- Base: `bg-slate-950` (near-black)
- Primary cards: `bg-slate-900` or `bg-slate-900/80`
- Creates focus, reduces eye strain during long interviews

### 2. **Glassmorphism**
- Backdrop blur: `backdrop-blur-xl`
- Semi-transparent backgrounds: `bg-white/5`, `bg-white/10`
- Subtle borders: `border-white/10`
- Creates depth and premium feel

### 3. **Vibrant Accents**
- Primary (Interviewer): Violet gradient `from-violet-600 to-indigo-600`
- Secondary (Candidate): Emerald gradient `from-emerald-600 to-teal-600`
- Warning: Red `bg-red-600`
- Info: Blue `bg-blue-600`

### 4. **Data Density**
- Information is valuable - don't hide it behind clicks
- Use grid layouts for efficient space usage
- Tabs for related content (Overview/Transcript)

### 5. **Smooth Motion**
- All transitions: `transition-all duration-300`
- Hover scale effects: `hover:scale-[1.02]`
- Fade-in animations: `animate-in fade-in duration-200`

---

## Component Patterns

### Cards

```tsx
<div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
  {/* Content */}
</div>
```

**Usage**: All container elements (briefing sections, debrief cards, waiting states)

---

### Buttons

#### Primary (Interviewer)
```tsx
<Button className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-500/25">
```

#### Primary (Candidate)
```tsx
<Button className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-500/25">
```

#### Secondary
```tsx
<Button className="bg-slate-700 hover:bg-slate-600">
```

#### Destructive
```tsx
<Button className="bg-red-600 hover:bg-red-700">
```

---

### Input Fields

```tsx
<Input className="bg-slate-900/50 border-white/10 text-white placeholder:text-slate-600 focus:border-violet-500 focus:ring-violet-500/20" />
```

**Features**:
- Dark background matches card
- Violet focus ring for interviewer context
- Low-opacity placeholder for hierarchy

---

### Modal Overlays

```tsx
{/* Backdrop */}
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
  {/* Modal Container */}
  <div className="w-full max-w-6xl h-[90vh] bg-slate-950 rounded-2xl overflow-hidden shadow-2xl border border-white/10">
    {/* Content */}
  </div>
</div>
```

**Key Details**:
- `fixed inset-0` - covers entire viewport
- `bg-black/80 backdrop-blur-sm` - creates depth, maintains context
- `max-w-6xl h-[90vh]` - constrains size, allows scrolling
- `z-50` - appears above all content

---

### Loading States

#### Spinner with Rotating Facts
```tsx
<div className="h-full flex flex-col items-center justify-center gap-4 p-8">
  <div className="relative mb-4">
    <div className="w-24 h-24 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
    <div className="absolute inset-0 flex items-center justify-center">
      <span className="text-3xl">🤖</span>
    </div>
  </div>
  
  <div className="space-y-2">
    <p className="text-violet-300 text-lg font-medium animate-pulse">
      Generating Candidate Intelligence...
    </p>
    <p className="text-white/60 text-xl font-light italic">
      "{facts[currentFactIndex]}"
    </p>
  </div>
</div>
```

**Why**: Engages user during 10-15 second AI generation, educational content reduces perceived wait time

---

### Score Rings (Circular Progress)

```tsx
<svg className="transform -rotate-90" width="120" height="120">
  <circle
    cx="60" cy="60" r="54"
    stroke="currentColor"
    className="text-white/10"
    strokeWidth="12"
    fill="none"
  />
  <circle
    cx="60" cy="60" r="54"
    stroke="url(#gradient)"
    strokeWidth="12"
    fill="none"
    strokeDasharray={circumference}
    strokeDashoffset={offset}
    strokeLinecap="round"
    className="transition-all duration-500"
  />
</svg>
```

**Usage**: Overall fit score, competency scores  
**Why**: More visually engaging than bars, evokes "mission control" gauges

---

### Competency Radar Chart

```tsx
<ResponsiveContainer width="100%" height={300}>
  <RadarChart data={radarData}>
    <PolarGrid stroke="rgba(255,255,255,0.1)" />
    <PolarAngleAxis
      dataKey="dimension"
      tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
    />
    <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fill: 'rgba(255,255,255,0.5)' }} />
    <Radar
      name="Score"
      dataKey="score"
      stroke="#8b5cf6"
      fill="#8b5cf6"
      fillOpacity={0.3}
    />
  </RadarChart>
</ResponsiveContainer>
```

**Usage**: Pre-interview brief dashboard  
**Why**: Shows competency balance at a glance, data-dense, visually striking

---

## Typography

### Headings

```tsx
// Page title
<h1 className="text-4xl md:text-5xl font-bold tracking-tight">
  <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-emerald-400">
    Title
  </span>
</h1>

// Section heading
<h2 className="text-2xl font-bold text-white">Section</h2>

// Subsection
<h3 className="text-lg font-semibold text-white/90">Subsection</h3>
```

### Body Text

```tsx
// Primary text
<p className="text-white">Main content</p>

// Secondary text
<p className="text-white/70">Supporting content</p>

// Tertiary text
<p className="text-white/50">Labels, hints</p>

// Muted text
<p className="text-white/40">Timestamps, metadata</p>
```

---

## Layout Patterns

### Flex Container (Full Height)

```tsx
<div className="flex flex-col h-full w-full relative overflow-hidden">
  {/* Fixed Header */}
  <div className="shrink-0 p-4 border-b border-white/10">
    Header
  </div>
  
  {/* Scrollable Content */}
  <div className="flex-1 min-h-0 overflow-y-auto">
    Content
  </div>
  
  {/* Fixed Footer */}
  <div className="shrink-0 p-4 border-t border-white/10">
    Footer
  </div>
</div>
```

**Key**: 
- `shrink-0` on header/footer prevents squashing
- `flex-1 min-h-0` on content allows proper scrolling
- `overflow-hidden` on parent prevents layout breaks

---

### Grid Layout (Equal Sizing)

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  {/* Each child gets equal space */}
  <div className="relative w-full h-full min-h-[300px]">
    Item 1
  </div>
  <div className="relative w-full h-full min-h-[300px]">
    Item 2
  </div>
</div>
```

**Usage**: Video tiles, stat cards  
**Why**: `min-h-[300px]` prevents collapse, `w-full h-full` in child ensures even distribution

---

## Iconography

### Icon Library: Lucide React

```tsx
import { Video, Mic, Phone, ThumbsUp, AlertTriangle, Clock } from "lucide-react";

<Button>
  <Video className="w-5 h-5 mr-2" />
  Start Call
</Button>
```

**Why**: Consistent stroke width, modern aesthetic, tree-shakeable

---

### Emoji Accents

Strategic emoji use for personality:
- 🤖 AI/Loading
- 🎬 Start Interview
- 🎭 AI Candidate
- 💡 Tips/Hints
- ⚠️ Warnings
- 📊 Analytics
- 👔 Interviewer
- 🎯 Candidate

---

## Responsive Design

### Mobile-First Breakpoints

```tsx
// Mobile default
<div className="p-4 text-sm">

// Tablet and up
<div className="md:p-6 md:text-base">

// Desktop and up
<div className="lg:p-8 lg:text-lg">
```

### Grid Responsiveness

```tsx
// Stack on mobile, 2-col on tablet+
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">

// Stack on mobile, 3-col on desktop
<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
```

---

## Accessibility Considerations

### Contrast Ratios

- Text on `bg-slate-950`: Use `text-white` (21:1 ratio) ✅
- Text on `bg-slate-900`: Use `text-white/90` or higher ✅
- Buttons with gradients: Ensure text is white with drop shadow if needed

### Focus States

All interactive elements use visible focus rings:

```tsx
// Default shadcn focus
focus:ring-2 focus:ring-violet-500 focus:ring-offset-2
```

### Screen Reader Support

- Use semantic HTML (`<button>`, `<nav>`, `<main>`)
- Provide `aria-label` for icon-only buttons
- Use `<label>` for all form inputs

---

## Animation Guidelines

### Entrance Animations

```tsx
// Fade in
className="animate-in fade-in duration-200"

// Zoom in (modals)
className="animate-in zoom-in-95 duration-200"

// Slide in from bottom
className="animate-in slide-in-from-bottom-4 duration-300"
```

### Hover Effects

```tsx
// Scale
className="transition-transform hover:scale-[1.02]"

// Background shift
className="transition-colors hover:bg-slate-800"

// Shadow expand
className="transition-shadow hover:shadow-xl"
```

### State Transitions

```tsx
// All properties
className="transition-all duration-300"

// Specific properties
className="transition-opacity duration-200"
```

**Rule**: Keep animations under 300ms to feel instant

---

## Color Palette Reference

```css
/* Backgrounds */
--slate-950: #020617;    /* Base background */
--slate-900: #0f172a;    /* Card background */
--slate-800: #1e293b;    /* Hover states */

/* Accents */
--violet-600: #7c3aed;   /* Primary (interviewer) */
--emerald-600: #059669;  /* Secondary (candidate) */
--red-600: #dc2626;      /* Destructive */
--blue-600: #2563eb;     /* Info */

/* Surfaces */
--white-10: rgba(255, 255, 255, 0.1);   /* Borders */
--white-5: rgba(255, 255, 255, 0.05);   /* Subtle backgrounds */
--black-80: rgba(0, 0, 0, 0.8);         /* Modal backdrops */
```

---

## Implementation Checklist

When building new components:

- [ ] Use dark base (`bg-slate-950` or `bg-slate-900`)
- [ ] Add glassmorphism (`backdrop-blur-xl`, `border-white/10`)
- [ ] Include smooth transitions (`transition-all duration-300`)
- [ ] Add hover states with scale or color shift
- [ ] Use gradient accents for CTAs
- [ ] Test on mobile + desktop viewports
- [ ] Verify text contrast (use `text-white` not `text-white/30` for body)
- [ ] Add loading states with spinners or skeletons
- [ ] Include focus states for keyboard navigation

---

## Examples in Codebase

- **Join Screen**: `frontend/src/components/join-screen.tsx`
- **Pre-Interview Brief**: `frontend/src/components/pre-interview-brief.tsx`
- **Video Room**: `frontend/src/components/video-room.tsx`
- **Debrief Screen**: `frontend/src/components/debrief-screen.tsx`
- **AI Sidebar**: `frontend/src/components/ai-chat-sidebar.tsx`
