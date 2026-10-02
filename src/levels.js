// Difficulty settings and the level progression.
import { SUBURB } from './maps/suburb.js';
import { DOWNTOWN } from './maps/downtown.js';
import { RIVERSIDE } from './maps/riverside.js';

export const MAPS = { suburb: SUBURB, downtown: DOWNTOWN, riverside: RIVERSIDE };

// Everything a difficulty changes. Level 3 is the "designed" baseline.
export const DIFFICULTIES = [
  {
    n: 1, name: 'Sunday Stroll', blurb: 'Hardly anyone is out. Anybody can do this.',
    time: 1.7, cooldown: [7, 10], grace: 6, maxActive: 1,
    steerRate: 0.7, reactionDelay: 0.75, commitDist: 2.8, maxSpeed: 3.0,
    awk: 0.5, decay: 2.5, ambient: -3, carRate: 0.35, carSpeed: 4.5, honk: 0.5,
  },
  {
    n: 2, name: 'Easy Tuesday', blurb: 'A few folks about. Mostly polite.',
    time: 1.35, cooldown: [5, 7.5], grace: 5, maxActive: 1,
    steerRate: 1.0, reactionDelay: 0.62, commitDist: 2.4, maxSpeed: 3.3,
    awk: 0.75, decay: 1.8, ambient: -1, carRate: 0.6, carSpeed: 5.5, honk: 0.75,
  },
  {
    n: 3, name: 'Rush Hour', blurb: 'Everyone has somewhere to be. So do you.',
    time: 1.0, cooldown: [3.6, 6], grace: 4, maxActive: 1,
    steerRate: 1.4, reactionDelay: 0.5, commitDist: 2.0, maxSpeed: 3.6,
    awk: 1.0, decay: 1.2, ambient: 0, carRate: 1.0, carSpeed: 6.5, honk: 1,
  },
  {
    n: 4, name: 'Black Friday', blurb: 'Two people at a time. They have coupons.',
    time: 0.82, cooldown: [2.0, 3.4], grace: 3, maxActive: 2,
    steerRate: 1.9, reactionDelay: 0.38, commitDist: 1.6, maxSpeed: 4.0,
    awk: 1.4, decay: 0.8, ambient: 3, carRate: 1.4, carSpeed: 7.5, honk: 1.25,
  },
  {
    n: 5, name: 'Parade Day', blurb: 'The entire town is on the sidewalk. Good luck.',
    time: 0.72, cooldown: [1.0, 2.0], grace: 2, maxActive: 3,
    steerRate: 2.6, reactionDelay: 0.25, commitDist: 1.2, maxSpeed: 4.6,
    awk: 1.5, decay: 0.6, ambient: 6, carRate: 2.0, carSpeed: 8.5, honk: 1.5,
  },
];

// `time` is the level-3 time limit in seconds (other difficulties scale it).
export const LEVELS = [
  {
    id: 'post', map: 'suburb', tod: 'morning', start: 'home', goal: 'po', time: 60, emoji: '📮',
    place: 'Post Office', arrive: 'Made it to the post office!',
    title: "Mail Aunt Linda's birthday card",
    blurb: "It's already three days late. The post office closes soon. It's two blocks away. How hard could it be?",
    winLine: 'The card is mailed. Aunt Linda will receive it in 6–8 business days.',
  },
  {
    id: 'lunch', map: 'suburb', tod: 'noon', start: 'home', goal: 'cafe', time: 45, emoji: '🥪', ambient: 3,
    place: 'Bean There Café', title: 'Grab a sandwich before the lunch rush',
    blurb: 'Lunch rush starts in under a minute. Everyone in the neighborhood is about to want the same sandwich.',
    winLine: 'You got the last turkey club. Someone behind you sighed audibly.',
  },
  {
    id: 'interview', map: 'downtown', tod: 'morning', start: 'subway', goal: 'synergy', time: 66, emoji: '💼',
    place: 'Synergy Corp', arrive: 'Made it to the interview!',
    title: 'Job interview at Synergy Corp',
    blurb: 'Big city, big opportunity. Your interview starts in minutes and the sidewalks are packed with people holding coffee.',
    winLine: 'You made it with seconds to spare. They asked where you see yourself in five years. "Not on a sidewalk," you said.',
  },
  {
    id: 'icecream', map: 'riverside', tod: 'afternoon', start: 'bakery', goal: 'scoops', time: 70, emoji: '🍦',
    place: 'Scoops Ahoy', arrive: 'Made it to the ice cream stand!',
    title: 'Get ice cream before the stand closes',
    blurb: 'It is the hottest day of the year. The ice cream stand is across the river. So is everyone with a dog.',
    winLine: 'One double scoop of mint chip. It melted in nine seconds. Worth it.',
  },
  {
    id: 'pizza', map: 'downtown', tod: 'sunset', start: 'hotel', goal: 'pizza', time: 64, emoji: '🍕',
    place: 'Slice Slice Baby', arrive: 'Made it to the pizza place!',
    title: 'Pick up the pizza while it is still hot',
    blurb: 'You ordered ahead like a responsible adult. The pizza is ready. Downtown at sunset is not.',
    winLine: 'Pizza acquired. Still hot. You did not share.',
  },
  {
    id: 'milk', map: 'suburb', tod: 'night', start: 'home', goal: 'grocery', time: 75, emoji: '🥛', ambient: 2,
    place: 'Aisle Be Back Grocery', title: 'Buy milk. Just milk.',
    blurb: 'It is late. The grocery store closes soon. You will only buy milk. (You will not only buy milk.)',
    winLine: 'You bought milk, cookies, three candles and a melon. Every errand is done. Time to lie down.',
  },
];

export const TIME_OF_DAY = {
  morning: { label: 'Morning', sky: '#9fd6f4', fog: [45, 120], hemi: ['#e8f4ff', '#6f8a5e', 1.5], sun: ['#fff3dc', 2.4], sunDir: [18, 40, 12], night: false },
  noon: { label: 'Noon', sky: '#8ccdf6', fog: [50, 130], hemi: ['#f4f9ff', '#7a9a66', 1.7], sun: ['#ffffff', 2.8], sunDir: [6, 50, 6], night: false },
  afternoon: { label: 'Afternoon', sky: '#a6d8f0', fog: [45, 120], hemi: ['#fff4e0', '#6f8a5e', 1.5], sun: ['#ffe7b8', 2.5], sunDir: [-20, 34, 14], night: false },
  sunset: { label: 'Sunset', sky: '#f4a985', fog: [35, 110], hemi: ['#ffd2b0', '#5a4a6a', 1.15], sun: ['#ff9f5a', 2.3], sunDir: [-36, 14, -10], night: false },
  night: { label: 'Night', sky: '#1c2346', fog: [25, 85], hemi: ['#7080c0', '#202034', 0.75], sun: ['#a8b8ff', 0.7], sunDir: [10, 40, -20], night: true },
};
