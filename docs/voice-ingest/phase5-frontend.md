# Phase 5: Frontend Components

## Overview

Build the premium frontend experience with glassmorphic cards that update in real-time as the voice agent extracts information. The UI should feel like it's thinking alongside the user.

---

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       FRONTEND COMPONENT TREE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  VoiceIngestPage                                                            │
│  ├── IntakeForm (Step 0)                                                    │
│  │   └── CompanyResearchStatus                                              │
│  │                                                                          │
│  ├── JDInput (Step 1)                                                       │
│  │   └── ExtractionSummary                                                  │
│  │                                                                          │
│  ├── VoiceSession (Step 2) ─────────────────────────────────┐               │
│  │   ├── VoiceAgentPanel                                    │               │
│  │   │   ├── AudioWaveform                                  │               │
│  │   │   ├── AgentTranscript                                │ WebSocket     │
│  │   │   └── VoiceControls                                  │ Updates       │
│  │   │                                                      │               │
│  │   └── ProfileBuilder ◄───────────────────────────────────┘               │
│  │       ├── CompanyCard                                                    │
│  │       ├── RequirementsCard                                               │
│  │       ├── TraitsCard                                                     │
│  │       ├── InterviewStagesCard                                            │
│  │       └── ProgressBar                                                    │
│  │                                                                          │
│  └── ReviewFinalize (Step 3)                                                │
│      ├── ProfileSummary                                                     │
│      ├── EmailTemplateEditor                                                │
│      └── CompleteButton                                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Design System

### Colors & Tokens

```tsx
// frontend/src/lib/design-tokens.ts

export const colors = {
  // Backgrounds
  bg: {
    primary: 'bg-slate-950',      // Main background
    card: 'bg-slate-900/50',      // Card background
    cardHover: 'bg-slate-800/50', // Card hover
    input: 'bg-slate-800/50',     // Input background
  },

  // Borders
  border: {
    default: 'border-slate-800',
    hover: 'border-slate-700',
    focus: 'border-violet-500',
    success: 'border-emerald-500/50',
  },

  // Text
  text: {
    primary: 'text-white',
    secondary: 'text-slate-400',
    muted: 'text-slate-500',
    accent: 'text-violet-400',
    success: 'text-emerald-400',
    warning: 'text-amber-400',
  },

  // Accents
  accent: {
    violet: 'from-violet-600 to-violet-500',
    emerald: 'from-emerald-600 to-emerald-500',
    gradient: 'from-violet-600 to-emerald-500',
  },
};

export const effects = {
  glassmorphism: 'backdrop-blur-xl bg-opacity-50',
  glow: {
    violet: 'shadow-lg shadow-violet-500/20',
    emerald: 'shadow-lg shadow-emerald-500/20',
  },
  transition: 'transition-all duration-300 ease-out',
};
```

### Base Card Component

```tsx
// frontend/src/components/voice-ingest/ui/GlassCard.tsx

import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GlassCardProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'pending' | 'active';
  glow?: boolean;
}

export function GlassCard({
  children,
  variant = 'default',
  glow = false,
  className,
  ...props
}: GlassCardProps) {
  const variants = {
    default: 'border-slate-800',
    success: 'border-emerald-500/50',
    pending: 'border-amber-500/30',
    active: 'border-violet-500/50',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'bg-slate-900/50 backdrop-blur-xl rounded-2xl border',
        'transition-all duration-300',
        variants[variant],
        glow && variant === 'success' && 'shadow-lg shadow-emerald-500/10',
        glow && variant === 'active' && 'shadow-lg shadow-violet-500/10',
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}
```

---

## Main Page Component

```tsx
// frontend/src/app/voice-ingest/page.tsx

'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { IntakeForm } from '@/components/voice-ingest/IntakeForm';
import { JDInput } from '@/components/voice-ingest/JDInput';
import { VoiceSession } from '@/components/voice-ingest/VoiceSession';
import { ReviewFinalize } from '@/components/voice-ingest/ReviewFinalize';

type Step = 'intake' | 'jd-input' | 'voice-session' | 'review';

interface SessionState {
  sessionId: string | null;
  companyName: string;
  userName: string;
  extractedProfile: Partial<JobProfile> | null;
  missingFields: string[];
}

export default function VoiceIngestPage() {
  const [step, setStep] = useState<Step>('intake');
  const [session, setSession] = useState<SessionState>({
    sessionId: null,
    companyName: '',
    userName: '',
    extractedProfile: null,
    missingFields: [],
  });

  const handleIntakeComplete = (data: {
    sessionId: string;
    firstName: string;
    companyName: string;
  }) => {
    setSession(prev => ({
      ...prev,
      sessionId: data.sessionId,
      userName: data.firstName,
      companyName: data.companyName,
    }));
    setStep('jd-input');
  };

  const handleJDExtracted = (result: {
    extracted: Partial<JobProfile>;
    missingRequired: string[];
  }) => {
    setSession(prev => ({
      ...prev,
      extractedProfile: result.extracted,
      missingFields: result.missingRequired,
    }));
    setStep('voice-session');
  };

  const handleSkipToVoice = () => {
    setStep('voice-session');
  };

  const handleVoiceComplete = () => {
    setStep('review');
  };

  const handleComplete = () => {
    // Navigate to candidate upload flow
    window.location.href = `/job/${session.sessionId}/candidates`;
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-violet-950/20 via-slate-950 to-emerald-950/10" />

      {/* Progress indicator */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <StepProgress currentStep={step} />
      </div>

      {/* Main content */}
      <main className="relative z-10 pt-20 pb-12 px-4">
        <AnimatePresence mode="wait">
          {step === 'intake' && (
            <motion.div
              key="intake"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <IntakeForm onComplete={handleIntakeComplete} />
            </motion.div>
          )}

          {step === 'jd-input' && (
            <motion.div
              key="jd-input"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <JDInput
                sessionId={session.sessionId!}
                onExtracted={handleJDExtracted}
                onSkipToVoice={handleSkipToVoice}
              />
            </motion.div>
          )}

          {step === 'voice-session' && (
            <motion.div
              key="voice-session"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <VoiceSession
                sessionId={session.sessionId!}
                userName={session.userName}
                companyName={session.companyName}
                initialProfile={session.extractedProfile}
                initialMissing={session.missingFields}
                onComplete={handleVoiceComplete}
              />
            </motion.div>
          )}

          {step === 'review' && (
            <motion.div
              key="review"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <ReviewFinalize
                sessionId={session.sessionId!}
                onComplete={handleComplete}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function StepProgress({ currentStep }: { currentStep: Step }) {
  const steps = [
    { key: 'intake', label: 'Start' },
    { key: 'jd-input', label: 'Job Description' },
    { key: 'voice-session', label: 'Build Profile' },
    { key: 'review', label: 'Review' },
  ];

  const currentIndex = steps.findIndex(s => s.key === currentStep);

  return (
    <div className="bg-slate-900/80 backdrop-blur-lg border-b border-slate-800 px-4 py-3">
      <div className="max-w-3xl mx-auto flex items-center gap-2">
        {steps.map((step, i) => (
          <div key={step.key} className="flex items-center">
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all',
                i < currentIndex && 'bg-emerald-500 text-white',
                i === currentIndex && 'bg-violet-500 text-white',
                i > currentIndex && 'bg-slate-800 text-slate-500'
              )}
            >
              {i < currentIndex ? '✓' : i + 1}
            </div>
            <span
              className={cn(
                'ml-2 text-sm hidden sm:block',
                i <= currentIndex ? 'text-white' : 'text-slate-500'
              )}
            >
              {step.label}
            </span>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  'w-8 sm:w-16 h-0.5 mx-2',
                  i < currentIndex ? 'bg-emerald-500' : 'bg-slate-800'
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Voice Session Component

```tsx
// frontend/src/components/voice-ingest/VoiceSession.tsx

'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  LiveKitRoom,
  useVoiceAssistant,
  BarVisualizer,
  RoomAudioRenderer,
  VoiceAssistantControlBar,
} from '@livekit/components-react';
import { GlassCard } from './ui/GlassCard';
import { ProfileBuilder } from './ProfileBuilder';
import { useWebSocket } from '@/hooks/useWebSocket';

interface VoiceSessionProps {
  sessionId: string;
  userName: string;
  companyName: string;
  initialProfile: Partial<JobProfile> | null;
  initialMissing: string[];
  onComplete: () => void;
}

export function VoiceSession({
  sessionId,
  userName,
  companyName,
  initialProfile,
  initialMissing,
  onComplete,
}: VoiceSessionProps) {
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<Partial<JobProfile>>(initialProfile || {});
  const [missingFields, setMissingFields] = useState<string[]>(initialMissing);
  const [isComplete, setIsComplete] = useState(false);

  // Get LiveKit token
  useEffect(() => {
    async function getToken() {
      const response = await fetch(`/api/voice-ingest/${sessionId}/token`);
      const data = await response.json();
      setToken(data.token);
    }
    getToken();
  }, [sessionId]);

  // WebSocket for real-time updates
  const { lastMessage } = useWebSocket(`/ws/${sessionId}`);

  // Handle WebSocket updates
  useEffect(() => {
    if (!lastMessage) return;

    const { type, data } = lastMessage;

    switch (type) {
      case 'requirements':
        setProfile(prev => ({
          ...prev,
          requirements: { ...prev.requirements, ...data },
        }));
        break;

      case 'trait_created':
        setProfile(prev => ({
          ...prev,
          traits: [...(prev.traits || []), data],
        }));
        break;

      case 'trait_updated':
        setProfile(prev => ({
          ...prev,
          traits: prev.traits?.map(t =>
            t.name === data.name ? { ...t, ...data.updates } : t
          ),
        }));
        break;

      case 'trait_deleted':
        setProfile(prev => ({
          ...prev,
          traits: prev.traits?.filter(t => t.name !== data.name),
        }));
        break;

      case 'stage_created':
        setProfile(prev => ({
          ...prev,
          interview_stages: [...(prev.interview_stages || []), data],
        }));
        break;

      case 'field_complete':
        setMissingFields(data.remaining);
        if (data.is_complete) {
          setIsComplete(true);
        }
        break;

      case 'onboarding_complete':
        setIsComplete(true);
        setTimeout(onComplete, 2000); // Brief delay to show completion
        break;
    }
  }, [lastMessage, onComplete]);

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Connecting to voice agent...</p>
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
      connect={true}
      audio={true}
      video={false}
    >
      <RoomAudioRenderer />
      <VoiceSessionInner
        userName={userName}
        companyName={companyName}
        profile={profile}
        missingFields={missingFields}
        isComplete={isComplete}
      />
    </LiveKitRoom>
  );
}

function VoiceSessionInner({
  userName,
  companyName,
  profile,
  missingFields,
  isComplete,
}: {
  userName: string;
  companyName: string;
  profile: Partial<JobProfile>;
  missingFields: string[];
  isComplete: boolean;
}) {
  const { state, audioTrack, agentTranscriptions } = useVoiceAssistant();

  return (
    <div className="max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Voice Agent Panel */}
        <div className="space-y-4">
          <GlassCard variant={state === 'speaking' ? 'active' : 'default'} className="p-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-white mb-1">
                Building profile for {companyName}
              </h2>
              <p className="text-slate-400 text-sm">
                {state === 'listening' && 'Listening...'}
                {state === 'thinking' && 'Thinking...'}
                {state === 'speaking' && 'Speaking...'}
                {state === 'idle' && 'Ready'}
              </p>
            </div>

            {/* Audio Visualizer */}
            <div className="h-24 mb-6 flex items-center justify-center">
              {audioTrack && (
                <BarVisualizer
                  state={state}
                  trackRef={audioTrack}
                  barCount={24}
                  className="h-full"
                  options={{
                    minHeight: 4,
                    maxHeight: 64,
                  }}
                />
              )}
              {!audioTrack && (
                <div className="flex gap-1">
                  {[...Array(24)].map((_, i) => (
                    <div
                      key={i}
                      className="w-1 bg-slate-700 rounded-full"
                      style={{ height: 4 + Math.random() * 20 }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Latest transcription */}
            {agentTranscriptions.length > 0 && (
              <div className="bg-slate-800/50 rounded-lg p-4 max-h-32 overflow-y-auto">
                <p className="text-slate-300 text-sm">
                  {agentTranscriptions[agentTranscriptions.length - 1]?.text}
                </p>
              </div>
            )}

            {/* Controls */}
            <div className="mt-6">
              <VoiceAssistantControlBar />
            </div>
          </GlassCard>

          {/* Progress indicator */}
          <GlassCard className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Profile completion</span>
              <span className="text-sm font-medium text-white">
                {calculateCompletion(profile, missingFields)}%
              </span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-violet-600 to-emerald-500"
                initial={{ width: 0 }}
                animate={{ width: `${calculateCompletion(profile, missingFields)}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            {missingFields.length > 0 && (
              <p className="text-xs text-slate-500 mt-2">
                Still needed: {missingFields.join(', ')}
              </p>
            )}
          </GlassCard>
        </div>

        {/* Right: Profile Builder */}
        <ProfileBuilder
          profile={profile}
          missingFields={missingFields}
          isComplete={isComplete}
        />
      </div>
    </div>
  );
}

function calculateCompletion(
  profile: Partial<JobProfile>,
  missing: string[]
): number {
  const total = 8;
  const found = total - missing.length;
  return Math.round((found / total) * 100);
}
```

---

## Profile Builder Component

```tsx
// frontend/src/components/voice-ingest/ProfileBuilder.tsx

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from './ui/GlassCard';
import { Building2, MapPin, DollarSign, Clock, Target, ListChecks } from 'lucide-react';

interface ProfileBuilderProps {
  profile: Partial<JobProfile>;
  missingFields: string[];
  isComplete: boolean;
}

export function ProfileBuilder({
  profile,
  missingFields,
  isComplete,
}: ProfileBuilderProps) {
  return (
    <div className="space-y-4">
      {/* Company Card */}
      <ProfileCard
        title="Company"
        icon={<Building2 className="w-5 h-5" />}
        isComplete={!!profile.company?.name}
        isMissing={false}
      >
        {profile.company?.name ? (
          <div className="space-y-2">
            <p className="text-white font-medium">{profile.company.name}</p>
            {profile.company.tagline && (
              <p className="text-slate-400 text-sm">{profile.company.tagline}</p>
            )}
            <div className="flex flex-wrap gap-2 mt-2">
              {profile.company.funding_stage && (
                <Badge>{profile.company.funding_stage.replace('_', ' ')}</Badge>
              )}
              {profile.company.team_size && (
                <Badge>{profile.company.team_size} people</Badge>
              )}
              {profile.company.headquarters && (
                <Badge>{profile.company.headquarters}</Badge>
              )}
            </div>
            {profile.company.interesting_facts?.length > 0 && (
              <p className="text-xs text-slate-500 mt-2">
                💡 {profile.company.interesting_facts[0]}
              </p>
            )}
          </div>
        ) : (
          <p className="text-slate-500 text-sm italic">From web research...</p>
        )}
      </ProfileCard>

      {/* Requirements Card */}
      <ProfileCard
        title="Role Requirements"
        icon={<MapPin className="w-5 h-5" />}
        isComplete={
          !missingFields.includes('job_title') &&
          !missingFields.includes('location') &&
          !missingFields.includes('experience')
        }
        isMissing={
          missingFields.includes('job_title') ||
          missingFields.includes('location') ||
          missingFields.includes('experience')
        }
      >
        <div className="space-y-3">
          <RequirementRow
            label="Title"
            value={profile.requirements?.job_title}
            pending={missingFields.includes('job_title')}
          />
          <RequirementRow
            label="Location"
            value={formatLocation(profile.requirements)}
            pending={missingFields.includes('location')}
          />
          <RequirementRow
            label="Experience"
            value={formatExperience(profile.requirements)}
            pending={missingFields.includes('experience')}
          />
          <RequirementRow
            label="Visa"
            value={
              profile.requirements?.visa_sponsorship === true
                ? 'Sponsors visas'
                : profile.requirements?.visa_sponsorship === false
                ? 'No sponsorship'
                : undefined
            }
            pending={missingFields.includes('visa')}
          />
        </div>
      </ProfileCard>

      {/* Compensation Card */}
      <ProfileCard
        title="Compensation"
        icon={<DollarSign className="w-5 h-5" />}
        isComplete={!missingFields.includes('compensation') && !missingFields.includes('equity')}
        isMissing={missingFields.includes('compensation') || missingFields.includes('equity')}
      >
        <div className="space-y-3">
          <RequirementRow
            label="Salary"
            value={formatSalary(profile.requirements)}
            pending={missingFields.includes('compensation')}
          />
          <RequirementRow
            label="Equity"
            value={
              profile.requirements?.equity_range ||
              (profile.requirements?.equity_offered ? 'Yes' : undefined)
            }
            pending={missingFields.includes('equity')}
          />
        </div>
      </ProfileCard>

      {/* Traits Card */}
      <ProfileCard
        title="Candidate Traits"
        icon={<Target className="w-5 h-5" />}
        isComplete={!missingFields.includes('traits')}
        isMissing={missingFields.includes('traits')}
      >
        <AnimatePresence mode="popLayout">
          {profile.traits && profile.traits.length > 0 ? (
            <div className="space-y-2">
              {profile.traits.map((trait, i) => (
                <motion.div
                  key={trait.id || trait.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-slate-800/30 rounded-lg p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-white font-medium">{trait.name}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        trait.priority === 'must_have'
                          ? 'bg-violet-500/20 text-violet-400'
                          : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {trait.priority === 'must_have' ? 'Must have' : 'Nice to have'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 mt-1">{trait.description}</p>
                  {trait.signals && trait.signals.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {trait.signals.map((signal, j) => (
                        <span
                          key={j}
                          className="text-xs px-2 py-0.5 bg-slate-700/50 text-slate-400 rounded"
                        >
                          {signal}
                        </span>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-sm italic">
              {missingFields.includes('traits')
                ? 'Waiting for trait information...'
                : 'No traits defined'}
            </p>
          )}
        </AnimatePresence>
      </ProfileCard>

      {/* Interview Stages Card */}
      <ProfileCard
        title="Interview Process"
        icon={<ListChecks className="w-5 h-5" />}
        isComplete={!missingFields.includes('interview_stages')}
        isMissing={missingFields.includes('interview_stages')}
      >
        <AnimatePresence mode="popLayout">
          {profile.interview_stages && profile.interview_stages.length > 0 ? (
            <div className="space-y-2">
              {profile.interview_stages
                .sort((a, b) => a.order - b.order)
                .map((stage, i) => (
                  <motion.div
                    key={stage.id || stage.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-start gap-3 bg-slate-800/30 rounded-lg p-3"
                  >
                    <div className="w-6 h-6 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center text-sm font-medium shrink-0">
                      {stage.order}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium">{stage.name}</p>
                      <p className="text-sm text-slate-400">{stage.description}</p>
                      {stage.duration_minutes && (
                        <p className="text-xs text-slate-500 mt-1">
                          <Clock className="w-3 h-3 inline mr-1" />
                          {stage.duration_minutes} min
                        </p>
                      )}
                    </div>
                  </motion.div>
                ))}
            </div>
          ) : (
            <p className="text-slate-500 text-sm italic">
              {missingFields.includes('interview_stages')
                ? 'Waiting for interview process...'
                : 'No stages defined'}
            </p>
          )}
        </AnimatePresence>
      </ProfileCard>

      {/* Completion indicator */}
      {isComplete && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-center"
        >
          <div className="text-emerald-400 text-lg font-medium mb-1">
            ✨ Profile Complete!
          </div>
          <p className="text-slate-400 text-sm">
            Moving to review...
          </p>
        </motion.div>
      )}
    </div>
  );
}

// Helper components
function ProfileCard({
  title,
  icon,
  isComplete,
  isMissing,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  isComplete: boolean;
  isMissing: boolean;
  children: React.ReactNode;
}) {
  return (
    <GlassCard
      variant={isComplete ? 'success' : isMissing ? 'pending' : 'default'}
      glow={isComplete}
      className="p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">{icon}</span>
          <h3 className="font-medium text-white">{title}</h3>
        </div>
        {isComplete && <span className="text-emerald-400">✓</span>}
        {isMissing && !isComplete && (
          <span className="text-amber-400 text-xs">Pending</span>
        )}
      </div>
      {children}
    </GlassCard>
  );
}

function RequirementRow({
  label,
  value,
  pending,
}: {
  label: string;
  value?: string;
  pending: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-400">{label}</span>
      {value ? (
        <span className="text-sm text-white">{value}</span>
      ) : pending ? (
        <span className="text-sm text-amber-400/60 italic">Waiting...</span>
      ) : (
        <span className="text-sm text-slate-600">—</span>
      )}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs px-2 py-0.5 bg-slate-800 text-slate-400 rounded">
      {children}
    </span>
  );
}

// Formatting helpers
function formatLocation(req?: HardRequirements): string | undefined {
  if (!req?.location_type) return undefined;
  let loc = req.location_type.charAt(0).toUpperCase() + req.location_type.slice(1);
  if (req.location_city) loc = `${req.location_city}, ${loc}`;
  if (req.onsite_days_per_week) loc += ` (${req.onsite_days_per_week}d/wk)`;
  return loc;
}

function formatExperience(req?: HardRequirements): string | undefined {
  if (req?.experience_min_years === undefined) return undefined;
  if (req.experience_max_years) {
    return `${req.experience_min_years}-${req.experience_max_years} years`;
  }
  return `${req.experience_min_years}+ years`;
}

function formatSalary(req?: HardRequirements): string | undefined {
  if (!req?.salary_min) return undefined;
  const min = (req.salary_min / 1000).toFixed(0);
  const max = req.salary_max ? (req.salary_max / 1000).toFixed(0) : min;
  return `$${min}k - $${max}k`;
}
```

---

## WebSocket Hook

```tsx
// frontend/src/hooks/useWebSocket.ts

import { useEffect, useState, useRef, useCallback } from 'react';

interface WebSocketMessage {
  type: string;
  data: any;
}

export function useWebSocket(url: string) {
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000'}${url}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        setLastMessage(message);
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log('WebSocket disconnected, reconnecting...');
      reconnectTimeoutRef.current = setTimeout(connect, 2000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    wsRef.current = ws;
  }, [url]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      wsRef.current?.close();
    };
  }, [connect]);

  return { lastMessage, isConnected };
}
```

---

## Next Phase

[Phase 6: Integration](./phase6-integration.md) - Connecting voice ingest to existing candidate flow
