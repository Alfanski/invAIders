export interface ContextSuggestion {
  text: string;
  prompt: string;
}

const WORKOUT_SUGGESTIONS: readonly ContextSuggestion[] = [
  { text: 'Analyze my splits', prompt: 'Can you analyze my splits from this workout?' },
  { text: 'How was my pacing?', prompt: 'How was my pacing strategy in this run?' },
  {
    text: 'What zones was I in?',
    prompt: 'What heart rate zones was I spending time in during this workout?',
  },
  { text: 'Compare to last run', prompt: 'How does this workout compare to my last similar run?' },
  { text: 'Recovery advice', prompt: 'What should I do for recovery after this workout?' },
];

const WEEK_SUGGESTIONS: readonly ContextSuggestion[] = [
  { text: 'How was my week?', prompt: 'Give me a summary of how my training week went.' },
  { text: 'Am I overtraining?', prompt: 'Based on this week, am I showing signs of overtraining?' },
  { text: 'Plan next week', prompt: 'Can you help me plan my training for next week?' },
  { text: 'Volume check', prompt: 'Is my weekly training volume appropriate for my goals?' },
  { text: 'Best session?', prompt: 'Which session this week was my best performance?' },
];

const FORM_SUGGESTIONS: readonly ContextSuggestion[] = [
  { text: 'What should I do today?', prompt: 'Based on my current form, what should I do today?' },
  { text: 'Am I race-ready?', prompt: 'Am I in good enough form to race this weekend?' },
  { text: 'Injury risk?', prompt: 'Is my current training load putting me at injury risk?' },
  { text: 'When to peak?', prompt: 'Based on my fitness trend, when will I be in peak form?' },
  {
    text: 'Explain my form',
    prompt: 'Explain what my current CTL, ATL and TSB numbers mean in plain language.',
  },
];

const DEFAULT_SUGGESTIONS: readonly ContextSuggestion[] = [
  { text: 'How am I doing?', prompt: 'Give me an overall assessment of my recent training.' },
  { text: 'Next session?', prompt: 'What should my next training session look like?' },
  { text: 'Training tips', prompt: 'Give me some personalized training tips based on my data.' },
];

export function getSuggestionsForRoute(pathname: string): readonly ContextSuggestion[] {
  if (pathname === '/dashboard') return WORKOUT_SUGGESTIONS;
  if (pathname === '/dashboard/week') return WEEK_SUGGESTIONS;
  if (pathname === '/dashboard/form') return FORM_SUGGESTIONS;
  return DEFAULT_SUGGESTIONS;
}

export function getRouteContext(pathname: string): string {
  if (pathname === '/dashboard') return 'the workout view showing latest run data';
  if (pathname === '/dashboard/week') return 'the weekly training summary';
  if (pathname === '/dashboard/form') return 'the training pulse page with fitness/fatigue metrics';
  return 'the dashboard';
}
