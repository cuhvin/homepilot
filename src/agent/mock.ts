// Offline stand-in for the LLM, used ONLY when the server runs with MOCK_LLM=1
// (local UI development without an API key). Responses are clearly labeled as mock.

import type { AgentResponse } from './schema.js';

const R = (r: AgentResponse) => JSON.stringify(r);

export function mockPlan(request: string): string {
  const q = request.toLowerCase();
  if (q.includes('movie')) {
    return R({
      kind: 'plan',
      understanding: 'Set up the living room for a movie.',
      steps: [
        { device: 'living.blinds', action: 'set', params: { position: 0 }, reason: 'Block glare on the screen' },
        { device: 'living.ceiling', action: 'set', params: { on: false }, reason: 'Overhead light washes out the picture' },
        { device: 'living.strip', action: 'set', params: { on: true, brightness: 40, color: 'purple' }, reason: 'Soft bias light behind the TV' },
        { device: 'living.lamp', action: 'set', params: { on: true, brightness: 20, color: 'warm' }, reason: 'Dim warm light for snacks' },
        { device: 'living.tv', action: 'set', params: { on: true, input: 'movies', volume: 35 }, reason: 'Start the movie' },
      ],
      checks: ['No sensitive steps.', '(mock response)'],
      message: 'Movie mode coming up! (mock LLM)',
    });
  }
  if (q.includes('weekend') || q.includes('leaving') || q.includes('vacation')) {
    return R({
      kind: 'plan',
      understanding: 'Secure the house and save energy while away for the weekend.',
      steps: [
        { device: 'living.tv', action: 'set', params: { on: false }, reason: 'Nobody watching' },
        { device: 'living.ceiling', action: 'set', params: { on: false }, reason: 'Save energy' },
        { device: 'kitchen.light', action: 'set', params: { on: false }, reason: 'Save energy' },
        { device: 'entry.frontdoor', action: 'lock', params: {}, reason: 'Secure the entry' },
        { device: 'garage.door', action: 'close', params: {}, reason: 'Secure the garage' },
        { device: 'home.thermostat', action: 'set', params: { mode: 'eco', target: 64 }, reason: 'Eco mode while away' },
        { device: 'home.alarm', action: 'arm', params: { mode: 'away' }, reason: 'Protect the empty house' },
        { device: 'living.lamp', action: 'set', params: { on: true, brightness: 50, color: 'warm' }, reason: 'Looks like someone is home', schedule: { at: '19:00', repeat: 'daily' } },
        { device: 'living.lamp', action: 'set', params: { on: false }, reason: 'Lights out at bedtime', schedule: { at: '23:00', repeat: 'daily' } },
      ],
      checks: ['No sensitive steps.', 'Lamp schedule simulates presence.', '(mock response)'],
      message: 'Locking up, eco heat, alarm on, and a lamp that turns on each evening. (mock LLM)',
    });
  }
  if (q.includes('dog walker') || q.includes('let') && q.includes('in')) {
    return R({
      kind: 'plan',
      understanding: 'Let the dog walker in and secure the house after.',
      steps: [
        { device: 'home.alarm', action: 'disarm', params: {}, reason: 'Walker would trip the alarm', schedule: { at: '14:58', repeat: 'once' } },
        { device: 'entry.frontdoor', action: 'unlock', params: {}, reason: 'Let the walker in', schedule: { at: '15:00', repeat: 'once' } },
        { device: 'entry.frontdoor', action: 'lock', params: {}, reason: 'Re-secure after the walk', schedule: { at: '16:00', repeat: 'once' } },
      ],
      checks: ['Disarm and unlock are SENSITIVE and need confirmation.', '(mock response)'],
      message: "I'll disarm and unlock at 3 PM and lock up at 4. Please confirm the security steps. (mock LLM)",
    });
  }
  if (q.includes('morning') || q.includes('coffee')) {
    return R({
      kind: 'plan',
      understanding: 'Weekday morning routine at 7:00.',
      steps: [
        { device: 'kitchen.coffee', action: 'brew', params: {}, reason: 'Coffee ready on wake-up', schedule: { at: '06:55', repeat: 'weekdays' } },
        { device: 'living.blinds', action: 'set', params: { position: 100 }, reason: 'Let the morning light in', schedule: { at: '07:00', repeat: 'weekdays' } },
        { device: 'home.thermostat', action: 'set', params: { mode: 'heat', target: 71 }, reason: 'Warm house in the morning', schedule: { at: '06:30', repeat: 'weekdays' } },
      ],
      checks: ['No sensitive steps.', '(mock response)'],
      message: 'Weekday mornings: heat at 6:30, coffee at 6:55, blinds up at 7. (mock LLM)',
    });
  }
  if (q.includes('pizza') || q.includes('order')) {
    return R({ kind: 'refuse', understanding: 'Order food.', steps: [], checks: ['(mock response)'], message: "I can't order food, but I can preheat the oven. (mock LLM)" });
  }
  return R({
    kind: 'clarify',
    understanding: 'Unclear target device.',
    steps: [],
    checks: ['Request is ambiguous.', '(mock response)'],
    message: 'Do you mean the TV volume, the speaker, or the temperature? (mock LLM)',
  });
}
