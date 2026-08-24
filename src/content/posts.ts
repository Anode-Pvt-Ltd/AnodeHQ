import type { Post } from "@/types/app";
import { img } from "./media";
import { team } from "./site";

export const topics = [
  { slug: "pcb-design", name: "PCB Design" },
  { slug: "firmware", name: "Firmware" },
  { slug: "manufacturing", name: "Manufacturing" },
  { slug: "compliance", name: "Compliance" },
];

export const posts: Post[] = [
  {
    id: "p-1",
    slug: "return-paths-are-the-signal",
    title: "Return paths are the signal you forgot to route",
    excerpt:
      "Most radiated emissions failures are decided long before the chamber, in the two or three places where a return current had nowhere sensible to go.",
    cover: img("post-return-paths", "Diagram of a signal trace crossing a split in the reference plane"),
    topic: topics[0]!,
    readMinutes: 8,
    publishedAt: "2026-05-12T09:00:00.000Z",
    updatedAt: "2026-05-12T09:00:00.000Z",
    status: "published",
    author: team[1]!,
    seoTitle: "Return Paths Are the Signal You Forgot to Route",
    seoDescription:
      "Why reference plane continuity decides EMC outcomes, and the three layout habits that cause most radiated emissions failures.",
    bodyHtml: `
<p>A signal is a loop. Whatever the schematic implies, current leaves a driver, travels down a track and comes back — and above a few megahertz it comes back directly underneath the track it went out on, because that is the path of least inductance.</p>
<p>Route a track over a gap in that reference and the return current has to go around. The loop area grows, and loop area is what radiates.</p>
<h3>Three habits that cause most of it</h3>
<h4>1. Crossing a plane split</h4>
<p>Analog and digital ground separated by a slot, with a track crossing between them, is the classic. The current detours to the nearest bridge, sometimes centimetres away. A single 100&nbsp;MHz clock routed across a split can add 15&nbsp;dB at its harmonics.</p>
<p>Either do not split the plane, or do not cross the split. A continuous plane with careful placement beats a split plane with a careful crossing, every time.</p>
<h4>2. Layer changes without a stitching via</h4>
<p>A signal that transitions from layer 1 to layer 6 changes reference plane. The return current has to find its own way between those planes — through whatever decoupling capacitor happens to be nearby. Place a ground via within a couple of millimetres of the signal via and the return has a defined path.</p>
<h4>3. Connectors without a local ground return</h4>
<p>Cables are efficient antennas. If the shield or the return pin does not connect to the same reference the driver sits on, common-mode current flows down the cable. Ground the connector locally, and filter what leaves the board.</p>
<h3>What this looks like in practice</h3>
<p>Before routing, mark the reference layer for every net class. During routing, check plane continuity underneath each critical net rather than trusting the DRC — most tools will not tell you that your reference disappeared. After routing, sweep a near-field probe across the board on the first prototype.</p>
<p>None of this is expensive. It is cheaper than a rebooked chamber slot, and considerably cheaper than a respin after tooling.</p>`.trim(),
  },
  {
    id: "p-2",
    slug: "bom-risk-is-a-design-input",
    title: "Your BOM is a risk register, not a shopping list",
    excerpt:
      "Lifecycle status, sourcing breadth and lead time belong beside price on every line — before layout, not during a shortage.",
    cover: img("post-bom-risk", "Bill of materials with lifecycle and lead time columns highlighted"),
    topic: topics[2]!,
    readMinutes: 6,
    publishedAt: "2026-04-22T09:00:00.000Z",
    updatedAt: "2026-04-22T09:00:00.000Z",
    status: "published",
    author: team[4]!,
    seoTitle: "Your BOM Is a Risk Register, Not a Shopping List",
    seoDescription:
      "How to treat lifecycle, sourcing and lead time as design inputs, and the BOM review that typically removes 15–35 % of cost.",
    bodyHtml: `
<p>A bill of materials with only part numbers and prices is a description of what you hope to buy. It says nothing about whether you will be able to.</p>
<h3>Four columns that change the conversation</h3>
<p><strong>Lifecycle status.</strong> Active, NRND or obsolete, taken from a lifecycle data source rather than the distributor's stock page. An NRND part on a design entering production is a redesign already scheduled, just not yet acknowledged.</p>
<p><strong>Sourcing count.</strong> How many manufacturers make a functionally and mechanically compatible part. One is a risk; the mitigation is a footprint that accepts two.</p>
<p><strong>Lead time.</strong> The real quoted figure, not the catalogue one. A 52-week part in a design with a 12-week schedule is the schedule, whatever the plan says.</p>
<p><strong>Approved alternate.</strong> Checked, not assumed. Same footprint, same critical parameters, verified against the circuit.</p>
<h3>Where the cost actually is</h3>
<p>Cost-down exercises usually attack the most expensive line. That is rarely where the money is. On a typical mature design we find:</p>
<ul>
<li><strong>Part consolidation</strong> — the same board carrying 10&nbsp;kΩ resistors in four tolerances and three packages. Consolidating reduces line count, reel changes and minimum order quantities.</li>
<li><strong>Tolerance that nobody analysed</strong> — 1&nbsp;% parts specified out of habit where the circuit tolerates 5&nbsp;%. Only relax where the worst-case analysis supports it, but do run the analysis.</li>
<li><strong>Assembly steps, not components</strong> — a slightly more expensive integrated part that removes a hand-soldering operation or a test failure mode is usually cheaper in the finished unit.</li>
</ul>
<p>Across the designs we have reviewed, the range is a 15–35&nbsp;% reduction without touching the specification. The important part is that every proposed change carries its saving and its risk, and the customer decides.</p>`.trim(),
  },
  {
    id: "p-3",
    slug: "ota-update-you-can-trust",
    title: "An OTA update path you can actually trust",
    excerpt:
      "Dual-bank storage, signed images and an automatic rollback that triggers on a health check — designed before the first feature is written.",
    cover: img("post-ota", "Diagram of an A/B firmware partition scheme with rollback"),
    topic: topics[1]!,
    readMinutes: 9,
    publishedAt: "2026-03-30T09:00:00.000Z",
    updatedAt: "2026-03-30T09:00:00.000Z",
    status: "published",
    author: team[2]!,
    seoTitle: "An OTA Update Path You Can Actually Trust",
    seoDescription:
      "Secure boot, A/B partitions, signed images and rollback-on-failure — the firmware update architecture that keeps a fielded fleet recoverable.",
    bodyHtml: `
<p>The most expensive failure a connected product can have is an update that bricks the fleet. Everything else is recoverable by shipping another update; that one is recoverable only by a truck roll.</p>
<h3>Design the recovery path first</h3>
<p>Before any feature work, we build and test the update mechanism, including its failure modes: power removed mid-write, a corrupted download, a valid image that fails to boot, and a valid image that boots but cannot reach the network.</p>
<h3>The four components</h3>
<p><strong>A chain of trust.</strong> An immutable first-stage bootloader verifies an ECDSA signature over the image before it is allowed to run. Keys live in a hardware-backed store where the silicon offers one.</p>
<p><strong>A and B slots.</strong> The running image is never overwritten. The new image lands in the inactive slot, is verified in place, and only then does the bootloader switch on the next reset.</p>
<p><strong>A health check with teeth.</strong> After the first boot of a new image the device must actively confirm it is healthy — peripherals initialised, configuration readable, network reachable — within a watchdog window. If it does not, the bootloader reverts to the previous slot without asking anyone.</p>
<p><strong>Staged rollout.</strong> One per cent, then ten, then the rest, with the metric that gates each stage decided in advance. If you cannot tell whether an update is going badly, you do not have a rollout, you have a hope.</p>
<h3>What this costs</h3>
<p>Roughly double the flash, and about two engineer-weeks. Against a truck roll to a few thousand devices, that is not a close call.</p>`.trim(),
  },
  {
    id: "p-4",
    slug: "emc-is-a-layout-decision",
    title: "EMC is decided at placement, not in the chamber",
    excerpt:
      "By the time you book the accredited lab, the outcome is already determined. Here is what to probe on revision A instead.",
    cover: img("post-emc", "Near-field probe held above a prototype board on a bench"),
    topic: topics[3]!,
    readMinutes: 7,
    publishedAt: "2026-02-18T09:00:00.000Z",
    updatedAt: "2026-02-18T09:00:00.000Z",
    status: "published",
    author: team[3]!,
    seoTitle: "EMC Is Decided at Placement, Not in the Chamber",
    seoDescription:
      "A practical in-house pre-compliance routine: near-field probing, conducted emissions and the ESD checks that find problems while layout can still change.",
    bodyHtml: `
<p>An accredited chamber tells you whether you passed. It rarely tells you why you failed, and by then the layout is frozen, the tooling is cut and the launch date is public.</p>
<h3>What to do on revision A</h3>
<p><strong>Near-field probing, one hour.</strong> Sweep an H-field probe across the board with the product running its worst-case workload. You are not measuring compliance, you are finding hot spots: a clock harmonic radiating from a specific track, a switcher loop, a connector shell.</p>
<p><strong>Conducted emissions with a LISN.</strong> Cheap, quick and highly correlated with the accredited result. Failures here are almost always input filter design or a common-mode path through a DC-DC transformer.</p>
<p><strong>ESD at the seams.</strong> Contact discharge to every accessible metal part and every connector shell. Look for resets, corrupted displays and hung buses. Immunity failures are usually cheaper to fix in layout than in the enclosure.</p>
<h3>Reading what you find</h3>
<p>A hot spot over a track means loop area. A hot spot over a connector means common-mode current on a cable. A broadband hash that moves with load means the switching converter. Each has a different fix, and all three are layout changes if you find them early enough.</p>
<h3>The arithmetic</h3>
<p>An in-house pre-compliance session costs a day. A failed accredited visit costs the chamber fee, a respin, new tooling if the enclosure moves, and typically six to ten weeks. Across our last twenty-four projects, twenty-one passed radiated emissions on the first accredited visit — and the three that did not failed on findings we had already flagged and the client had accepted as a risk.</p>`.trim(),
  },
];

export const postBySlug = (slug: string) => posts.find((p) => p.slug === slug);
