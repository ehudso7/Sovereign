import { WorkOS } from "@workos-inc/node";
import {
  AppError,
  err,
  ok,
} from "@sovereign/core";
import type {
  AuthConfig,
  AuthResult,
  InvitationService,
  OrgService,
  Result,
  User,
  UserId,
} from "@sovereign/core";
import type { MembershipRepo, OrgRepo, UserRepo, InvitationRepo } from "@sovereign/db";
import { isAllowedBrowserUrl, resolveDefaultAllowedOrigin } from "../lib/cors.js";
import {
  buildDisplayName,
  buildWorkosLoginCookie,
  clearWorkosLoginCookie,
  createWorkosBootstrapToken,
  createWorkosLoginStateToken,
  extractWorkosSessionId,
  parseCookieHeader,
  verifyWorkosBootstrapToken,
  verifyWorkosLoginStateToken,
  WORKOS_LOGIN_COOKIE,
} from "../lib/workos-auth.js";
import { buildRedirectWithFragment, isAllowedAuthCallbackUrl } from "../lib/urls.js";
import type { PgAuthService } from "./auth.service.js";

interface BeginLoginParams {
  apiOrigin: string;
  returnTo?: string;
  loginHint?: string;
  screenHint?: "sign-in" | "sign-up";
}

interface BeginLoginResult {
  authorizationUrl: string;
  stateCookie: string;
}

interface HandleCallbackParams {
  code?: string;
  state?: string;
  error?: string;
  errorDescription?: string;
  cookieHeader?: string;
  ipAddress?: string;
  userAgent?: string;
}

interface WorkosProfile {
  id: string;
  email: string;
  emailVerified: boolean;
  profilePictureUrl: string | null;
  firstName: string | null;
  lastName: string | null;
}

export class WorkosAuthService {
  private readonly workos: WorkOS | null;

  constructor(
    private readonly config: AuthConfig,
    private readonly authService: PgAuthService,
    private readonly orgService: OrgService,
    private readonly invitationService: InvitationService,
    private readonly userRepo: UserRepo,
    private readonly membershipRepo: MembershipRepo,
    private readonly orgRepo: OrgRepo,
    private readonly invitationRepo: InvitationRepo,
  ) {
    if (config.mode === "workos" && config.workos?.apiKey && config.workos.clientId) {
      this.workos = new WorkOS({
        apiKey: config.workos.apiKey,
        clientId: config.workos.clientId,
      });
    } else {
      this.workos = null;
    }
  }

  isEnabled(): boolean {
    return this.config.mode === "workos";
  }

  clearLoginStateCookie(): string {
    return clearWorkosLoginCookie();
  }

  async beginLogin(params: BeginLoginParams): Promise<Result<BeginLoginResult>> {
    const client = this.getClient();
    if (!client.ok) {
      return client;
    }

    const returnTo = this.resolveReturnTo(params.returnTo);
    if (!returnTo.ok) {
      return returnTo;
    }

    try {
      const { url, state, codeVerifier } = await client.value.userManagement.getAuthorizationUrlWithPKCE({
        provider: "authkit",
        clientId: this.config.workos!.clientId,
        redirectUri: new URL("/api/v1/auth/callback", params.apiOrigin).toString(),
        ...(params.loginHint ? { loginHint: params.loginHint } : {}),
        ...(params.screenHint ? { screenHint: params.screenHint } : {}),
      });

      const stateToken = createWorkosLoginStateToken({
        state,
        codeVerifier,
        returnTo: returnTo.value,
      }, this.config.sessionSecret);

      return ok({
        authorizationUrl: url,
        stateCookie: buildWorkosLoginCookie(stateToken),
      });
    } catch (error) {
      return err(AppError.internal(this.getErrorMessage(error, "Failed to create WorkOS authorization URL")));
    }
  }

  async handleCallback(params: HandleCallbackParams): Promise<string> {
    const fallbackReturnTo = this.defaultCallbackReturnTo();
    const cookieValue = parseCookieHeader(params.cookieHeader)[WORKOS_LOGIN_COOKIE];
    const loginState = cookieValue
      ? verifyWorkosLoginStateToken(cookieValue, this.config.sessionSecret)
      : null;
    const returnTo = loginState?.returnTo ?? fallbackReturnTo;

    if (!returnTo) {
      return "/auth/sign-in";
    }

    if (params.error) {
      return this.errorRedirect(returnTo, params.errorDescription ?? params.error);
    }

    if (!params.code || !params.state) {
      return this.errorRedirect(returnTo, "Missing WorkOS callback parameters.");
    }

    if (!loginState || loginState.state !== params.state) {
      return this.errorRedirect(returnTo, "WorkOS login session expired. Try signing in again.");
    }

    const client = this.getClient();
    if (!client.ok) {
      return this.errorRedirect(returnTo, client.error.message);
    }

    try {
      const response = await client.value.userManagement.authenticateWithCode({
        clientId: this.config.workos!.clientId,
        code: params.code,
        codeVerifier: loginState.codeVerifier,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });

      if (!response.user.emailVerified) {
        return this.errorRedirect(returnTo, "This WorkOS account does not have a verified email.");
      }

      const syncedUser = await this.syncUser(response.user);
      if (!syncedUser.ok) {
        return this.errorRedirect(returnTo, syncedUser.error.message);
      }

      const invitationResult = await this.acceptPendingInvitations(syncedUser.value);
      if (!invitationResult.ok) {
        return this.errorRedirect(returnTo, invitationResult.error.message);
      }

      const memberships = await this.membershipRepo.listForUser(syncedUser.value.id);
      const providerSessionId = extractWorkosSessionId(response.accessToken);

      if (memberships.length > 0) {
        const authResult = await this.authService.signInToOrg(
          syncedUser.value.id,
          memberships[0]!.orgId,
          params.ipAddress,
          params.userAgent,
          providerSessionId,
        );

        if (!authResult.ok) {
          return this.errorRedirect(returnTo, authResult.error.message);
        }

        return buildRedirectWithFragment(returnTo, {
          session_token: authResult.value.sessionToken,
          expires_at: authResult.value.expiresAt,
        });
      }

      const orgCount = await this.orgRepo.countAll();
      if (orgCount === 0) {
        const bootstrapToken = createWorkosBootstrapToken({
          userId: syncedUser.value.id,
          email: syncedUser.value.email,
          name: syncedUser.value.name,
          providerSessionId,
        }, this.config.sessionSecret);

        const setupUrl = new URL(returnTo);
        setupUrl.pathname = "/auth/setup";
        setupUrl.search = "";

        return buildRedirectWithFragment(setupUrl.toString(), {
          bootstrap_token: bootstrapToken,
          email: syncedUser.value.email,
          name: syncedUser.value.name,
        });
      }

      return this.errorRedirect(returnTo, "No organization membership was found for this account.");
    } catch (error) {
      return this.errorRedirect(returnTo, this.getErrorMessage(error, "WorkOS authentication failed."));
    }
  }

  async completeBootstrap(params: {
    token: string;
    orgName: string;
    orgSlug: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<Result<AuthResult>> {
    const payload = verifyWorkosBootstrapToken(params.token, this.config.sessionSecret);
    if (!payload) {
      return err(AppError.unauthorized("Bootstrap token is invalid or expired."));
    }

    const orgCount = await this.orgRepo.countAll();
    if (orgCount > 0) {
      return err(AppError.conflict("Workspace bootstrap is only allowed on an empty installation."));
    }

    const userId = payload.userId as UserId;
    const existingMemberships = await this.membershipRepo.listForUser(userId);
    if (existingMemberships.length > 0) {
      return err(AppError.conflict("This user already belongs to an organization."));
    }

    const user = await this.userRepo.getById(userId);
    if (!user) {
      return err(AppError.unauthorized("WorkOS bootstrap user was not found."));
    }

    const orgResult = await this.orgService.create(
      { name: params.orgName, slug: params.orgSlug },
      user.id,
    );

    if (!orgResult.ok) {
      return orgResult;
    }

    return this.authService.signInToOrg(
      user.id,
      orgResult.value.id,
      params.ipAddress,
      params.userAgent,
      payload.providerSessionId,
    );
  }

  buildLogoutUrl(providerSessionId: string | undefined, returnTo: string): string | null {
    if (!providerSessionId || !this.workos) {
      return null;
    }

    if (!isAllowedBrowserUrl(returnTo)) {
      return null;
    }

    return this.workos.userManagement.getLogoutUrl({
      sessionId: providerSessionId,
      returnTo,
    });
  }

  private getClient(): Result<WorkOS> {
    if (!this.workos || this.config.mode !== "workos" || !this.config.workos?.clientId) {
      return err(AppError.badRequest("WorkOS auth is not enabled."));
    }

    return ok(this.workos);
  }

  private resolveReturnTo(returnTo?: string): Result<string> {
    const target = returnTo ?? this.defaultCallbackReturnTo();

    if (!target) {
      return err(AppError.badRequest("No allowed frontend callback URL is configured."));
    }

    if (!isAllowedAuthCallbackUrl(target)) {
      return err(AppError.badRequest("returnTo must be an allowed /auth/callback URL."));
    }

    return ok(target);
  }

  private defaultCallbackReturnTo(): string | null {
    const origin = resolveDefaultAllowedOrigin();
    return origin ? new URL("/auth/callback", origin).toString() : null;
  }

  private errorRedirect(returnTo: string, message: string): string {
    return buildRedirectWithFragment(returnTo, {
      error: message,
    });
  }

  private async syncUser(profile: WorkosProfile): Promise<Result<User>> {
    const existingByWorkos = await this.userRepo.getByWorkosUserId(profile.id);
    const existingByEmail = await this.userRepo.getByEmail(profile.email);
    const name = buildDisplayName({
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
    });
    const updateInput = {
      email: profile.email,
      name,
      avatarUrl: profile.profilePictureUrl ?? undefined,
      workosUserId: profile.id,
    };

    if (existingByWorkos && existingByEmail && existingByWorkos.id !== existingByEmail.id) {
      return err(AppError.conflict("This WorkOS account conflicts with an existing local user record."));
    }

    if (existingByWorkos) {
      const updated = await this.userRepo.update(existingByWorkos.id, updateInput);
      return updated
        ? ok(updated)
        : err(AppError.internal("Failed to update local user from WorkOS."));
    }

    if (existingByEmail) {
      if (existingByEmail.workosUserId && existingByEmail.workosUserId !== profile.id) {
        return err(AppError.conflict("This email address is already linked to another WorkOS account."));
      }

      const updated = await this.userRepo.update(existingByEmail.id, updateInput);
      return updated
        ? ok(updated)
        : err(AppError.internal("Failed to link local user to WorkOS."));
    }

    try {
      const user = await this.userRepo.create(updateInput);
      return ok(user);
    } catch (error) {
      return err(AppError.internal(this.getErrorMessage(error, "Failed to create a local user for WorkOS.")));
    }
  }

  private async acceptPendingInvitations(user: User): Promise<Result<void>> {
    const invitations = await this.invitationRepo.listPendingForEmail(user.email);

    for (const invitation of invitations) {
      const membership = await this.membershipRepo.getForUser(invitation.orgId, user.id);
      if (membership) {
        continue;
      }

      const accepted = await this.invitationService.accept(invitation.id, user.id);
      if (!accepted.ok && accepted.error.code !== "CONFLICT") {
        return err(accepted.error);
      }
    }

    return ok(undefined);
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof AppError) {
      return error.message;
    }

    if (error instanceof Error && error.message.length > 0) {
      return error.message;
    }

    return fallback;
  }
}
