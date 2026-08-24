import { services } from "./services";
import { industries } from "./industries";
import { projects } from "./projects";
import { posts, topics } from "./posts";
import { heroModel } from "./pcb";
import {
  settings, processStages, team, testimonials, clients, stats, certifications, faqs,
  navigation, footerNavigation,
} from "./site";

// Live counts rather than typed-in numbers — Table 12.4 says the tile count is derived.
const published = projects.filter((p) => p.status === "published");
for (const ind of industries) {
  ind.projectCount = published.filter((p) => p.industry?.slug === ind.slug).length;
}

export {
  services, industries, projects, posts, topics, heroModel,
  settings, processStages, team, testimonials, clients, stats, certifications, faqs,
  navigation, footerNavigation,
};
export { serviceBySlug } from "./services";
export { industryBySlug } from "./industries";
export { projectBySlug } from "./projects";
export { postBySlug } from "./posts";
export { heroBoard } from "./pcb";
export type { BoardDefinition, BoardPart, PartKind } from "./pcb";
