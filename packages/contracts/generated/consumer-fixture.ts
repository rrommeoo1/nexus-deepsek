import type { ActionIntent, ChainActionExecutedV1, CreateActionRequest, NexusActionsClient } from './index';

export function consumeActionContracts(
  request: CreateActionRequest,
  intent: ActionIntent,
  event: ChainActionExecutedV1,
  client: NexusActionsClient
): string {
  void request;
  void client;
  return intent.id + ':' + event.data.originalTxHash;
}
