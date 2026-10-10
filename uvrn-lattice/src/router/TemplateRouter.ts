import type { DecompositionSpec, DomainSpec, LatticeTemplate } from '../types';

const DOMAIN_LABELS: Record<string, string> = {
  cultural: 'Cultural',
  economic: 'Economic',
  technical: 'Technical',
  legal: 'Legal',
  financial: 'Financial',
  scientific: 'Scientific',
  seo: 'SEO',
};

export class TemplateRouter {
  decompose(query: string, template: LatticeTemplate): DecompositionSpec {
    const domains = template.domains.map((domainId): DomainSpec => {
      const label = DOMAIN_LABELS[domainId] ?? titleCase(domainId);

      return {
        id: domainId,
        label,
        signalCategories: [...template.signalCategories],
        normalizationProfile: template.normalization,
        explanation: `${label} domain spec derived from the ${template.name} lattice template.`,
      };
    });

    return {
      templateRef: template.id,
      query,
      domains,
      explanation: `Query decomposed into ${domains.length} domain-specific signal bundles using ${template.name}.`,
    };
  }
}

function titleCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
