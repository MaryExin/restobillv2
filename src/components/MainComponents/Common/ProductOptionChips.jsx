import React from "react";

/**
 * Chip picker for a product's suggested options.
 * groups: [{ group_name, select_type: "single"|"multi", options, default_option }]
 * selections: { [group_name]: "choice" | ["choice", ...] }
 */
const ProductOptionChips = ({ groups = [], selections = {}, onChange, isDark = false }) => {
  if (!groups.length) return null;

  const pick = (group, option) => {
    const current = selections[group.group_name];
    if (group.select_type === "multi") {
      const values = Array.isArray(current) ? current : [];
      const next = values.includes(option)
        ? values.filter((value) => value !== option)
        : [...values, option];
      onChange({ ...selections, [group.group_name]: next });
      return;
    }
    // Tapping the chosen option again clears it (unless it is the default).
    const next = current === option && option !== group.default_option ? "" : option;
    onChange({ ...selections, [group.group_name]: next });
  };

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const current = selections[group.group_name];
        return (
          <div key={group.group_name} role="group" aria-label={group.group_name}>
            <div className="mb-1.5 flex items-baseline gap-2">
              <span
                className={`text-[11px] font-black uppercase tracking-[0.12em] ${
                  isDark ? "text-slate-300" : "text-slate-600"
                }`}
              >
                {group.group_name}
              </span>
              <span className={`text-[10px] ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                {group.select_type === "multi" ? "pick any" : "pick one"}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {group.options.map((option) => {
                const selected =
                  group.select_type === "multi"
                    ? Array.isArray(current) && current.includes(option)
                    : current === option;
                const isDefault = group.select_type === "single" && option === group.default_option;
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => pick(group, option)}
                    className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                      selected
                        ? "border-transparent bg-[var(--app-accent)] text-[#fff]"
                        : isDark
                          ? "border-white/15 bg-white/5 text-slate-200 hover:border-white/40"
                          : "border-slate-300 bg-white text-slate-700 hover:border-slate-500"
                    }`}
                  >
                    {option}
                    {isDefault ? (
                      <span className={`ml-1 text-[10px] ${selected ? "opacity-80" : "opacity-60"}`}>
                        (default)
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ProductOptionChips;
