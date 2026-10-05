import { useCallback, useEffect, useState } from 'react';
import { loadGameTextures, type GameTextures } from './render/textures';

export type TextureLoadState =
  | { readonly status: 'loading'; readonly progress: number }
  | { readonly status: 'ready'; readonly textures: GameTextures }
  | { readonly status: 'error'; readonly message: string };

export function useGameTextures(): TextureLoadState & { retry: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<TextureLoadState>({ status: 'loading', progress: 0 });

  useEffect(() => {
    let cancelled = false;
    loadGameTextures((progress) => {
      if (!cancelled) setState({ status: 'loading', progress });
    })
      .then((textures) => {
        if (!cancelled) setState({ status: 'ready', textures });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'Unknown error';
        setState({ status: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading', progress: 0 });
    setAttempt((value) => value + 1);
  }, []);

  return { ...state, retry };
}
