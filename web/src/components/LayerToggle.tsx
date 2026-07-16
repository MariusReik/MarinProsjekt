interface LayerToggleProps {
  localitiesVisible: boolean;
  localityCount: number;
  onToggleLocalities: (visible: boolean) => void;
}

/**
 * Map layer switcher (issue #13). Currently the single toggleable layer is the
 * aquaculture localities (markers + click-through metadata added in #12); the
 * count doubles as lightweight metadata on how many sites are loaded. Kept as a
 * small overlay control so it sits over the map like the status bar.
 */
export function LayerToggle({
  localitiesVisible,
  localityCount,
  onToggleLocalities,
}: LayerToggleProps) {
  return (
    <div className="layer-toggle">
      <label>
        <input
          type="checkbox"
          checked={localitiesVisible}
          onChange={(e) => onToggleLocalities(e.target.checked)}
        />
        <span className="layer-swatch" aria-hidden />
        <span className="layer-name">Lokaliteter</span>
        <span className="layer-count">{localityCount}</span>
      </label>
    </div>
  );
}
