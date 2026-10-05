import { useId, useState } from 'react';
import {
  DIFFICULTIES,
  DIFFICULTY_PRESETS,
  OPTION_LIMITS,
  type Difficulty,
  type PlayerOptions,
} from '../../game/config';
import {
  CAPTAIN_NAME_LIMITS,
  validateOptions,
  type OptionErrors,
  type OptionsDraft,
  type PlayerProfile,
} from '../../storage/settings';
import { Button, RoundButton } from '../../ui/Button';

interface OptionsPanelProps {
  readonly options: PlayerOptions;
  readonly profile: PlayerProfile;
  readonly title?: string;
  readonly titleId: string;
  readonly submitLabel?: string;
  readonly onSubmitted?: () => void;
  readonly note?: string;
  readonly onSave: (options: PlayerOptions, captainName: string) => boolean;
  readonly soundEnabled: boolean;
  readonly onSoundChange: (enabled: boolean) => void;
  readonly onClose: () => void;
  readonly closeLabel: string;
}

export function OptionsPanel({
  options,
  profile,
  title = 'Options',
  titleId,
  submitLabel = 'Save',
  onSubmitted,
  note,
  onSave,
  soundEnabled,
  onSoundChange,
  onClose,
  closeLabel,
}: OptionsPanelProps) {
  const [draft, setDraft] = useState<OptionsDraft>({
    matchDurationSeconds: String(options.matchDurationSeconds),
    spawnIntervalSeconds: String(options.spawnIntervalSeconds),
    difficulty: options.difficulty,
    captainName: profile.captainName,
  });
  const [errors, setErrors] = useState<OptionErrors>({});
  const [status, setStatus] = useState<string>('');

  const update = (field: Exclude<keyof OptionsDraft, 'difficulty'>, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setStatus('');
  };

  const handleSubmit = () => {
    const result = validateOptions(draft);
    if ('errors' in result) {
      setErrors(result.errors);
      setStatus('Please fix the highlighted fields.');
      return;
    }
    setErrors({});
    const stored = onSave(result.options, result.captainName);
    if (onSubmitted) {
      onSubmitted();
      return;
    }
    setStatus(
      stored
        ? 'Options saved. They apply to your next battle.'
        : 'Options could not be stored on this device.',
    );
  };

  return (
    <section className="panel" aria-labelledby={titleId}>
      <h1 className="panel__title" id={titleId}>
        {title}
      </h1>
      {note && <p className="status-text">{note}</p>}
      <form
        className="options-form"
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
        noValidate
      >
        <NumberStepper
          label="Game session time"
          unit="s"
          value={draft.matchDurationSeconds}
          limits={OPTION_LIMITS.matchDurationSeconds}
          stepBy={10}
          hint={`${OPTION_LIMITS.matchDurationSeconds.min}–${OPTION_LIMITS.matchDurationSeconds.max} seconds`}
          error={errors.matchDurationSeconds}
          onChange={(value) => {
            update('matchDurationSeconds', value);
          }}
        />
        <NumberStepper
          label="Enemy spawn time"
          unit="s"
          value={draft.spawnIntervalSeconds}
          limits={OPTION_LIMITS.spawnIntervalSeconds}
          stepBy={OPTION_LIMITS.spawnIntervalSeconds.step}
          hint={`${OPTION_LIMITS.spawnIntervalSeconds.min}–${OPTION_LIMITS.spawnIntervalSeconds.max} seconds, in ${OPTION_LIMITS.spawnIntervalSeconds.step} s steps`}
          error={errors.spawnIntervalSeconds}
          onChange={(value) => {
            update('spawnIntervalSeconds', value);
          }}
        />
        <DifficultyPicker
          value={draft.difficulty}
          onChange={(difficulty) => {
            setDraft((current) => ({ ...current, difficulty }));
            setStatus('');
          }}
        />
        <TextField
          label="Captain name"
          value={draft.captainName}
          hint={`${CAPTAIN_NAME_LIMITS.min}–${CAPTAIN_NAME_LIMITS.max} characters, shown in the ranking`}
          error={errors.captainName}
          onChange={(value) => {
            update('captainName', value);
          }}
        />
        <label className="toggle">
          <input
            type="checkbox"
            checked={soundEnabled}
            onChange={(event) => {
              onSoundChange(event.target.checked);
            }}
          />
          <span>Sound effects</span>
        </label>
        <p className="status-text" role="status">
          {status}
        </p>
        <div className="button-stack">
          <Button type="submit" autoFocus={onSubmitted !== undefined}>
            {submitLabel}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            {closeLabel}
          </Button>
        </div>
      </form>
    </section>
  );
}

function DifficultyPicker({
  value,
  onChange,
}: {
  value: Difficulty;
  onChange: (difficulty: Difficulty) => void;
}) {
  const name = useId();
  return (
    <fieldset className="field difficulty">
      <legend className="field__label">Difficulty</legend>
      <div className="difficulty__options">
        {DIFFICULTIES.map((difficulty) => {
          const preset = DIFFICULTY_PRESETS[difficulty];
          const descriptionId = `${name}-${difficulty}`;
          return (
            <label key={difficulty} className="difficulty__option" data-difficulty={difficulty}>
              <input
                type="radio"
                name={name}
                value={difficulty}
                checked={value === difficulty}
                aria-describedby={descriptionId}
                onChange={() => {
                  onChange(difficulty);
                }}
              />
              <span className="difficulty__name">{preset.label}</span>
              <span className="difficulty__description" id={descriptionId}>
                {preset.description}
              </span>
            </label>
          );
        })}
      </div>
      <p className="field__hint">Each difficulty has its own ranking.</p>
    </fieldset>
  );
}

interface FieldProps {
  readonly label: string;
  readonly value: string;
  readonly hint: string;
  readonly error: string | undefined;
  readonly onChange: (value: string) => void;
}

interface NumberStepperProps extends FieldProps {
  readonly unit: string;
  readonly stepBy: number;
  readonly limits: { readonly min: number; readonly max: number; readonly step: number };
}

function NumberStepper({
  label,
  unit,
  value,
  hint,
  error,
  limits,
  stepBy,
  onChange,
}: NumberStepperProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const numeric = Number(value);

  const nudge = (direction: 1 | -1) => {
    const base = Number.isFinite(numeric) ? numeric : limits.min;
    const next = Math.min(limits.max, Math.max(limits.min, base + direction * stepBy));
    onChange(String(Math.round(next / limits.step) * limits.step));
  };

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <div className="field__stepper">
        <RoundButton
          icon="minus"
          label={`Decrease ${label.toLowerCase()}`}
          size={44}
          onClick={() => {
            nudge(-1);
          }}
          disabled={Number.isFinite(numeric) && numeric <= limits.min}
        />
        <span className="field__input-wrap">
          <input
            id={id}
            className="field__input"
            inputMode="decimal"
            value={value}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${errorId} ${hintId}` : hintId}
            onChange={(event) => {
              onChange(event.target.value);
            }}
          />
          <span aria-hidden="true">{unit}</span>
        </span>
        <RoundButton
          icon="plus"
          label={`Increase ${label.toLowerCase()}`}
          size={44}
          onClick={() => {
            nudge(1);
          }}
          disabled={Number.isFinite(numeric) && numeric >= limits.max}
        />
      </div>
      <p className="field__hint" id={hintId}>
        {hint}
      </p>
      {error && (
        <p className="field__error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function TextField({ label, value, hint, error, onChange }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="field__input field__input--text"
        value={value}
        maxLength={40}
        autoComplete="nickname"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${errorId} ${hintId}` : hintId}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
      <p className="field__hint" id={hintId}>
        {hint}
      </p>
      {error && (
        <p className="field__error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
