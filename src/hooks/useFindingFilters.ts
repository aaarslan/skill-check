import { useCallback, useState } from "react";
import { toggleInSet } from "../components/toggleSet.ts";

export interface FindingFiltersState<TSeverity extends string, TCategory extends string> {
  readonly selectedSeverities: ReadonlySet<TSeverity>;
  readonly selectedCategories: ReadonlySet<TCategory>;
  readonly toggleSeverity: (severity: TSeverity) => void;
  readonly toggleCategory: (category: TCategory) => void;
}

/**
 * Multi-select severity + category filter state, shared by the quality and injection
 * panels. Both filters start with every option selected. Callers apply the two selected
 * sets to their own findings, which lets each keep its own severity field name
 * (quality's `severity`, injection's `suspicion`).
 */
export function useFindingFilters<TSeverity extends string, TCategory extends string>(
  allSeverities: readonly TSeverity[],
  allCategories: readonly TCategory[],
): FindingFiltersState<TSeverity, TCategory> {
  const [selectedSeverities, setSelectedSeverities] = useState<ReadonlySet<TSeverity>>(
    () => new Set(allSeverities),
  );
  const [selectedCategories, setSelectedCategories] = useState<ReadonlySet<TCategory>>(
    () => new Set(allCategories),
  );

  const toggleSeverity = useCallback((severity: TSeverity) => {
    setSelectedSeverities((current) => toggleInSet(current, severity));
  }, []);
  const toggleCategory = useCallback((category: TCategory) => {
    setSelectedCategories((current) => toggleInSet(current, category));
  }, []);

  return { selectedSeverities, selectedCategories, toggleSeverity, toggleCategory };
}
