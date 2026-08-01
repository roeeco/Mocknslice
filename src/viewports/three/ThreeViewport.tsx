import { Canvas } from '@react-three/fiber';
import { copy } from '../../locales/en';
import { useProjectStore } from '../../state/useProjectStore';
import type { CameraPreset } from '../../state/types';
import { CubeScene } from './CubeScene';

const cameraPresets: { id: CameraPreset; label: string }[] = [
  { id: 'isometric', label: 'Isometric' },
  { id: 'front', label: 'Front' },
  { id: 'side', label: 'Side' },
  { id: 'top', label: 'Top' },
];

export function ThreeViewport() {
  const cameraPreset = useProjectStore((state) => state.cameraPreset);
  const setCameraPreset = useProjectStore((state) => state.setCameraPreset);

  return (
    <section className="viewport-stage" aria-label={copy.modelPreview}>
      <div className="viewport-toolbar" aria-label="Camera presets">
        {cameraPresets.map((preset) => (
          <button
            type="button"
            key={preset.id}
            className={cameraPreset === preset.id ? 'is-selected' : undefined}
            aria-pressed={cameraPreset === preset.id}
            onClick={() => setCameraPreset(preset.id)}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <Canvas camera={{ position: [82, 68, 82], fov: 38 }} shadows>
        <CubeScene />
      </Canvas>
      <div className="viewport-legend">
        <span>
          <i className="legend-swatch model-swatch" /> Model
        </span>
        <span>
          <i className="legend-line" /> 10 mm grid
        </span>
      </div>
    </section>
  );
}
