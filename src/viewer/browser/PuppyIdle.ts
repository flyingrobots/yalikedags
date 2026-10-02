import { gsap } from "gsap";
import type { PuppyRig } from "./PuppyRig.ts";
import { PuppyPostureClip } from "./PuppyPostureClip.ts";
import { motionDuration, motionNumber, motionPreference } from "./MotionPolicy.ts";

/** Freshly sampled pauses and gestures, without consecutive repeats or a looping clip. */
export class PuppyIdle {
  private timeline: gsap.core.Timeline | undefined;
  private previous = "";
  private bowing = false;
  constructor(private readonly svg: SVGSVGElement, private readonly rig: PuppyRig) {
    for (const event of ["pointerenter", "click", "focusin", "yalikedags:puppy-attention"]) {
      svg.addEventListener(event, () => { this.interrupt(); });
    }
    document.addEventListener("yalikedags:puppy-action", () => { this.interrupt(); });
    document.addEventListener("yalikedags:themechange", () => { this.interrupt(); });
    document.addEventListener("visibilitychange", () => { this.suspend(); });
    motionPreference.addEventListener("change", () => { this.suspend(); });
    this.schedule();
  }
  private available(): boolean {
    const box = this.svg.getBoundingClientRect();
    return !document.hidden && !motionPreference.matches && box.width > 0 && box.bottom > 0 && box.top < innerHeight;
  }
  private standing(): boolean {
    return Array.from(this.rig.pose().values()).every(point => Math.hypot(point.x, point.y) < .01);
  }
  private schedule(): void {
    this.timeline?.kill();
    if (document.hidden || motionPreference.matches) { return; }
    const pause = motionNumber("--motion-idle-delay") + Math.pow(Math.random(), 1.6) * motionNumber("--motion-idle-variance");
    this.timeline = gsap.timeline().call(() => { this.gesture(); }, [], Math.max(.1, pause));
  }
  private gesture(): void {
    if (!this.available()) { this.schedule(); return; }
    const choices = ["tail", "tail", "head", "ears", ...(this.standing() ? ["bow"] : [])].filter(name => name !== this.previous);
    const name = choices[Math.floor(Math.random() * choices.length)] ?? "ears";
    this.previous = name; this.svg.dataset["puppyIdle"] = name;
    if (name === "bow") { this.bow(); return; }
    const duration = motionDuration(`--motion-${name === "head" ? "head" : name === "tail" ? "tail" : "ear"}-duration`) * (.7 + Math.random() * .8);
    this.secondary(name, duration);
    this.timeline = gsap.timeline({ onComplete: () => { delete this.svg.dataset["puppyIdle"]; this.schedule(); } }).to({}, { duration });
  }
  private secondary(name: string, duration: number): void {
    const scale = (.35 + Math.random() * .65) * (Math.random() < .5 ? -1 : 1);
    if (name === "tail") {
      const angle = motionNumber("--motion-tail-angle") * scale;
      const beats = 2 + Math.floor(Math.random() * 3);
      this.rig.tail.play([...Array.from({ length: beats * 2 }, (_, i) => angle * (i % 2 === 0 ? 1 : -.7)), 0], duration);
      if (Math.random() < .35) { this.rig.ears.play([4 * scale, -2 * scale, 0], duration); }
    } else if (name === "head") {
      const angle = motionNumber("--motion-head-angle") * scale;
      this.rig.head.play([angle, angle * .8, -angle * .2, 0], duration);
    } else {
      const angle = motionNumber("--motion-ear-angle") * scale;
      this.rig.ears.play([angle, -angle * .4, angle * .2, 0], duration);
    }
  }
  private bow(): void {
    this.bowing = true;
    const duration = motionDuration("--motion-posture-duration");
    this.rig.play(new PuppyPostureClip(this.rig.geometry).packet("bow", this.rig.pose()), duration);
    this.timeline = gsap.timeline({ onComplete: () => { this.bowing = false; delete this.svg.dataset["puppyIdle"]; this.schedule(); } });
    this.timeline.call(() => { this.secondary("tail", motionDuration("--motion-tail-duration")); }, [], duration)
      .call(() => { this.stand(); }, [], duration + .7 + Math.random() * 1.8)
      .to({}, { duration });
  }
  private stand(): void {
    this.rig.play(new PuppyPostureClip(this.rig.geometry).packet("stand", this.rig.pose()), motionDuration("--motion-posture-duration"));
  }
  private interrupt(): void {
    this.timeline?.kill();
    if (this.bowing) { this.stand(); this.bowing = false; }
    delete this.svg.dataset["puppyIdle"]; this.schedule();
  }
  private suspend(): void {
    this.timeline?.kill(); this.bowing = false;
    delete this.svg.dataset["puppyIdle"]; this.schedule();
  }
}
