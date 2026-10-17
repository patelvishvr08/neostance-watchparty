// A damped spring, sampled into native Web Animations keyframes.
// Nothing runs in the animation loop on the main JavaScript thread.
export function springFrames(distance = 24, count = 48): Keyframe[] {
  const stiffness = 190, damping = 24, mass = 1;
  const natural = Math.sqrt(stiffness / mass);
  const ratio = damping / (2 * Math.sqrt(stiffness * mass));
  const angular = natural * Math.sqrt(1 - ratio * ratio);
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1) * 0.85;
    const displacement = Math.exp(-ratio * natural * t) * (Math.cos(angular * t) + ratio * natural / angular * Math.sin(angular * t));
    return { offset: i / (count - 1), opacity: Math.max(0, Math.min(1, 1 - displacement)), transform: `translateY(${distance * displacement}px) scale(${1 - .025 * displacement})`, filter: `blur(${Math.max(0, displacement * 4)}px)` };
  });
}
