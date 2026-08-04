import type { RuntimeFailure } from '../domain/runtimeFailure';
import { runtimeFailureMessage } from '../domain/runtimeFailure';
import { useProjectStore } from '../state/useProjectStore';

export function RuntimeFailureMessage({ failure }: { failure: RuntimeFailure }) {
  const locale = useProjectStore((state) => state.locale);
  return <>{runtimeFailureMessage(failure, locale)}</>;
}
