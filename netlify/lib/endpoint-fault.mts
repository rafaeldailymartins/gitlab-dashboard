/** Why a document endpoint answered `503`. Constants, never anything a request carried. */
export type FaultReason = 'identity-unavailable' | 'store-unavailable'

/**
 * A `503` a document endpoint answered, as something a tracker can group.
 *
 * Made where the endpoint gave up rather than where it reports, so that each
 * place a `503` comes from has a stack of its own and lands as an issue of its
 * own. Its message is the reason and nothing else, which is why `scrub` may send
 * it: the store's own error, which can quote the key it failed on — and the key
 * is the reader's subject — travels as the `cause`, where only its class and
 * stack survive.
 */
export class EndpointFault extends Error {
  readonly reason: FaultReason

  constructor(reason: FaultReason, options?: ErrorOptions) {
    super(reason, options)

    this.name = 'EndpointFault'
    this.reason = reason
  }
}
