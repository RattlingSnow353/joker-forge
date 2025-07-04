import type { Rule, Effect } from "../ruleBuilder/types";
import type { JokerData, UserVariable } from "../JokerCard";

export interface VariableInfo {
  name: string;
  initialValue: number;
  usedInEffects: string[];
}

export interface VariableUsage {
  variableName: string;
  ruleId: string;
  ruleIndex: number;
  type: "condition" | "effect";
  itemId: string;
  count: number;
}

const INTERNAL_PARAMETERS = new Set([
  "has_random_chance",
  "chance_numerator",
  "chance_denominator",
  "operation",
  "operator",
  "card_scope",
  "quantifier",
  "negate",
  "rank_type",
  "rank_group",
  "specific_rank",
  "suit_type",
  "suit_group",
  "specific_suit",
  "count",
  "value_source",
  "enhancement",
  "seal",
  "edition",
  "blind_type",
  "variable_name",
  "joker_type",
  "rarity",
  "joker_key",
  "random",
  "common",
  "j_joker",
  "tarot_card",
  "planet_card",
  "spectral_card",
  "is_negative",
  "consumable_type",
  "specific_card",
  "selection_method",
  "position",
  "specific_index",
  "suit",
  "rank",
  "new_rank",
  "new_suit",
  "new_enhancement",
  "new_seal",
  "new_edition",
  "card_index",
  "card_rank",
  "card_suit",
  "source_type",
  "target_type",
  "source_enhancement",
  "target_enhancement",
  "source_seal",
  "target_seal",
  "source_edition",
  "target_edition",
  "source_rank",
  "target_rank",
  "source_suit",
  "target_suit",
  "source_rank_type",
  "source_ranks",
  "target_rank",
  "size_type",
  "property_type",
]);

export const coordinateVariableConflicts = (
  effects: Effect[]
): {
  preReturnCode?: string;
  modifiedEffects: Effect[];
} => {
  const readVars = new Set<string>();
  const writeVars = new Set<string>();

  effects.forEach((effect) => {
    if (effect.type === "modify_internal_variable") {
      const varName = effect.params.variable_name as string;
      if (varName) {
        writeVars.add(varName);
      }
    }

    Object.entries(effect.params).forEach(([key, value]) => {
      if (
        typeof value === "string" &&
        !INTERNAL_PARAMETERS.has(key) &&
        key !== "variable_name" &&
        isValidVariableName(value)
      ) {
        readVars.add(value);
      }
    });
  });

  const conflicts = Array.from(readVars).filter((varName) =>
    writeVars.has(varName)
  );

  if (conflicts.length === 0) {
    return { modifiedEffects: effects };
  }

  const preReturnCode = conflicts
    .map((varName) => `local ${varName}_value = card.ability.extra.${varName}`)
    .join("\n                ");

  const modifiedEffects = effects.map((effect) => {
    if (effect.type === "modify_internal_variable") {
      return effect;
    }

    const modifiedParams = { ...effect.params };
    Object.entries(effect.params).forEach(([key, value]) => {
      if (
        typeof value === "string" &&
        conflicts.includes(value) &&
        !INTERNAL_PARAMETERS.has(key)
      ) {
        modifiedParams[key] = `${value}_value`;
      }
    });

    return { ...effect, params: modifiedParams };
  });

  return { preReturnCode, modifiedEffects };
};

const isValidVariableName = (str: string): boolean => {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(str);
};

export const extractVariablesFromRules = (rules: Rule[]): VariableInfo[] => {
  const variableMap = new Map<string, VariableInfo>();

  rules.forEach((rule) => {
    rule.conditionGroups.forEach((group) => {
      group.conditions.forEach((condition) => {
        if (condition.type === "internal_variable") {
          const varName = (condition.params.variable_name as string) || "var1";
          if (!variableMap.has(varName)) {
            variableMap.set(varName, {
              name: varName,
              initialValue: 0,
              usedInEffects: [],
            });
          }
        }
      });
    });

    rule.effects.forEach((effect) => {
      if (effect.type === "modify_internal_variable") {
        const varName = (effect.params.variable_name as string) || "var1";
        if (!variableMap.has(varName)) {
          variableMap.set(varName, {
            name: varName,
            initialValue: 0,
            usedInEffects: [],
          });
        }
        variableMap.get(varName)!.usedInEffects.push(effect.type);
      }

      Object.entries(effect.params).forEach(([key, value]) => {
        if (
          typeof value === "string" &&
          !INTERNAL_PARAMETERS.has(key) &&
          key !== "variable_name" &&
          isValidVariableName(value)
        ) {
          if (!variableMap.has(value)) {
            variableMap.set(value, {
              name: value,
              initialValue: 0,
              usedInEffects: [],
            });
          }
          variableMap.get(value)!.usedInEffects.push(effect.type);
        }
      });
    });
  });

  return Array.from(variableMap.values());
};

export const generateVariableConfig = (variables: VariableInfo[]): string => {
  if (variables.length === 0) return "";

  const configItems = variables.map((variable) => {
    return `${variable.name} = ${variable.initialValue}`;
  });

  return configItems.join(",\n            ");
};

export const generateVariableLocVars = (
  variables: VariableInfo[]
): string[] => {
  return variables.map((variable) => `card.ability.extra.${variable.name}`);
};

export const getVariableNamesFromJoker = (joker: JokerData): string[] => {
  if (!joker.rules) return [];

  const variableNames = new Set<string>();

  joker.rules.forEach((rule) => {
    rule.effects.forEach((effect) => {
      if (effect.type === "modify_internal_variable") {
        const varName = (effect.params.variable_name as string) || "var1";
        variableNames.add(varName);
      }

      Object.entries(effect.params).forEach(([key, value]) => {
        if (
          typeof value === "string" &&
          !INTERNAL_PARAMETERS.has(key) &&
          key !== "variable_name" &&
          isValidVariableName(value)
        ) {
          variableNames.add(value);
        }
      });
    });

    rule.conditionGroups.forEach((group) => {
      group.conditions.forEach((condition) => {
        if (condition.type === "internal_variable") {
          const varName = (condition.params.variable_name as string) || "var1";
          variableNames.add(varName);
        }
      });
    });
  });

  return Array.from(variableNames).sort();
};

export const getVariableUsageDetails = (joker: JokerData): VariableUsage[] => {
  if (!joker.rules) return [];

  const usageDetails: VariableUsage[] = [];
  const usageCount = new Map<string, number>();

  joker.rules.forEach((rule, ruleIndex) => {
    rule.effects.forEach((effect) => {
      if (effect.type === "modify_internal_variable") {
        const varName = (effect.params.variable_name as string) || "var1";
        const currentCount = usageCount.get(varName) || 0;
        usageCount.set(varName, currentCount + 1);

        usageDetails.push({
          variableName: varName,
          ruleId: rule.id,
          ruleIndex: ruleIndex + 1,
          type: "effect",
          itemId: effect.id,
          count: currentCount + 1,
        });
      }

      Object.entries(effect.params).forEach(([key, value]) => {
        if (
          typeof value === "string" &&
          !INTERNAL_PARAMETERS.has(key) &&
          key !== "variable_name" &&
          isValidVariableName(value)
        ) {
          const currentCount = usageCount.get(value) || 0;
          usageCount.set(value, currentCount + 1);

          usageDetails.push({
            variableName: value,
            ruleId: rule.id,
            ruleIndex: ruleIndex + 1,
            type: "effect",
            itemId: effect.id,
            count: currentCount + 1,
          });
        }
      });
    });

    rule.conditionGroups.forEach((group) => {
      group.conditions.forEach((condition) => {
        if (condition.type === "internal_variable") {
          const varName = (condition.params.variable_name as string) || "var1";
          const currentCount = usageCount.get(varName) || 0;
          usageCount.set(varName, currentCount + 1);

          usageDetails.push({
            variableName: varName,
            ruleId: rule.id,
            ruleIndex: ruleIndex + 1,
            type: "condition",
            itemId: condition.id,
            count: currentCount + 1,
          });
        }
      });
    });
  });

  return usageDetails;
};

export const getAllVariables = (joker: JokerData): UserVariable[] => {
  const userVars = joker.userVariables || [];
  const autoVars = getVariableNamesFromJoker(joker)
    .filter((name) => !userVars.some((uv) => uv.name === name))
    .map((name) => ({
      id: `auto_${name}`,
      name,
      initialValue: getDefaultVariableValue(name),
      description: getDefaultVariableDescription(name),
    }));

  return [...userVars, ...autoVars];
};

const getDefaultVariableValue = (name: string): number => {
  const defaults: Record<string, number> = {
    chips: 10,
    mult: 5,
    Xmult: 1.5,
    dollars: 5,
    repetitions: 1,
    hands: 1,
    discards: 1,
    levels: 1,
  };
  return defaults[name] || 0;
};

const getDefaultVariableDescription = (name: string): string => {
  const descriptions: Record<string, string> = {
    chips: "Chips to add",
    mult: "Mult to add",
    Xmult: "X Mult multiplier",
    dollars: "Money to add",
    repetitions: "Card repetitions",
    hands: "Hands to modify",
    discards: "Discards to modify",
    levels: "Hand levels to add",
  };
  return descriptions[name] || "Custom variable";
};
