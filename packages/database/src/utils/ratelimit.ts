import { Ratelimit } from "@upstash/ratelimit";
import { defaultRedis } from "../redis";
import { Redis } from "@upstash/redis";
import { PlanDAL, UserDAL } from "../dal";
import { Duration } from "../types";

export class ModelRateLimiter extends Ratelimit {
  /**
   * construct a new model rate limiter by email and model provided
   * @returns null if the plan or model does not exist
   */
  static async of(
    { email, model, redis = defaultRedis }: CreateModelRateLimiterParams,
  ): Promise<ModelRateLimiter | null> {
    const userDAL = new UserDAL(redis);
    const planDAL = new PlanDAL(redis);

    const planName = await userDAL.readPlan(email) ?? "free";
    const planLimit = await planDAL.readProperty(planName, "limits");
    const modelLimit = planLimit?.[model];

    if (!modelLimit) return null;

    const { limit, window } = modelLimit;
    return new ModelRateLimiter({
      redis,
      email,
      planName,
      model,
      limit,
      window: window as Duration,
    });
  }

  #email: string;

  private constructor(
    { redis = defaultRedis, planName, model, limit, window, email }:
      ConstructModelRateLimiterParams,
  ) {
    super({
      redis,
      prefix: `ratelimit:${planName}:${model}:`,
      limiter: Ratelimit.slidingWindow(limit, window),
    });

    this.#email = email;
  }

  override limit = () => super.limit(this.#email);
}

/**
 * construct a new model rate limiter by specified prefix
 * @returns ratelimit
 */
export function keywordRateLimiterOf(
  { prefix, limit, window, ephemeralCache = undefined, redis = defaultRedis }:
    CreateKeywordRateLimiterParams,
): Ratelimit {
  return new Ratelimit({
    redis,
    prefix: `ratelimit:${prefix}:`,
    limiter: Ratelimit.slidingWindow(limit, window as Duration),
    ephemeralCache,
  });
}

export type CreateKeywordRateLimiterParams = {
  prefix: string;
  limit: number;
  window: string;
  ephemeralCache?: Map<string, number> | undefined;
  redis?: Redis;
};

export type CreateModelRateLimiterParams = {
  email: string;
  model: string;
  redis?: Redis;
};

type ConstructModelRateLimiterParams = {
  redis?: Redis;
  email: string;
  planName: string;
  model: string;
  limit: number;
  window: Duration;
};