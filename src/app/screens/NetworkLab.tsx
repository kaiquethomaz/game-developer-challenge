import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { pendingMatches } from '../../api/pendingMatches';
import { mockBackend } from '../../mocks/mockBackend';
import {
  NETWORK_SCENARIOS,
  SCENARIO_DESCRIPTIONS,
  type NetworkScenario,
} from '../../mocks/scenarios';
import { Button } from '../../ui/Button';

export function NetworkLab({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [scenario, setScenario] = useState<NetworkScenario>(mockBackend.getSettings().scenario);
  const [status, setStatus] = useState('');

  const choose = (next: NetworkScenario) => {
    mockBackend.setScenario(next);
    setScenario(next);
    setStatus(`Scenario set to ${next}.`);
    void queryClient.invalidateQueries();
  };

  const reset = () => {
    mockBackend.reset();
    queryClient.clear();
    setScenario(mockBackend.getSettings().scenario);
    setStatus('Mock server data and scenario restored to their initial state.');
  };

  return (
    <section className="panel panel--wide network-lab" aria-labelledby="network-lab-title">
      <h1 className="panel__title" id="network-lab-title">
        Network scenarios
      </h1>
      <p className="status-text">
        Simulate the ranking and history API. Only the mock server is affected; gameplay always
        works offline.
      </p>
      <fieldset className="network-lab__list">
        <legend className="visually-hidden">Scenario</legend>
        {NETWORK_SCENARIOS.map((item) => (
          <label key={item} className="network-lab__option">
            <input
              type="radio"
              name="scenario"
              value={item}
              checked={scenario === item}
              onChange={() => {
                choose(item);
              }}
            />
            <span>
              <strong>{item}</strong>
              <small>{SCENARIO_DESCRIPTIONS[item]}</small>
            </span>
          </label>
        ))}
      </fieldset>
      <p className="status-text" role="status">
        {status}
      </p>
      <div className="button-row">
        <Button variant="secondary" size="small" onClick={reset}>
          Reset mock data
        </Button>
        <Button
          variant="secondary"
          size="small"
          onClick={() => {
            pendingMatches.reload();
            setStatus(`${pendingMatches.getSnapshot().length} battles waiting to be recorded.`);
          }}
        >
          Check pending
        </Button>
        <Button size="small" onClick={onClose}>
          Close
        </Button>
      </div>
    </section>
  );
}
