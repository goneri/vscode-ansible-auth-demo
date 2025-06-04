// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { AuthenticationSession } from "vscode";

interface ILightspeedMe {
  family_name: string;
  given_name: string;
}

export interface LightspeedAuthSession extends AuthenticationSession {
  rhOrgHasSubscription: boolean;
  rhUserIsOrgAdmin: boolean;
}

export const ANSIBLE_LIGHTSPEED_AUTH_ID = `auth-lightspeed`;
export const ANSIBLE_LIGHTSPEED_AUTH_NAME = `Ansible Lightspeed`;
export const RHSSO_AUTH_ID = "redhat-account-auth";

export const LIGHTSPEED_AUTH_REQUEST = "ansible.lightspeed.oauth";

vscode.commands.executeCommand(LIGHTSPEED_AUTH_REQUEST);

function getAuthProviderOrder() {
  // NOTE: We can't gate this check on if this extension is active,
  // because it only activates on an authentication request.
  if (!vscode.extensions.getExtension("redhat.vscode-redhat-account")) {
    return [ANSIBLE_LIGHTSPEED_AUTH_ID];
  }
  return [ANSIBLE_LIGHTSPEED_AUTH_ID, "redhat-account-auth"];
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "vscode-ansible-auth-demo.whoami",
      async () => {
        if (!vscode.extensions.getExtension("redhat.ansible")) {
          vscode.window.showErrorMessage(
            "vscode-ansible-auth-demo - redhat.ansible is not installed"
          );
          return;
        }

        const lightspeedSettings =
          vscode.workspace.getConfiguration("ansible.lightspeed");

        const lightspeedEnabled = lightspeedSettings.get(
          "ansible.lightspeed.enabled",
          true
        );
        if (!lightspeedEnabled) {
          await vscode.window.showErrorMessage(
            "vscode-ansible-auth-demo - Lightspeed is disabled!"
          );
          return;
        }
        const lightspeedURL = lightspeedSettings.get(
          "ansible.lightspeed.URL",
          "https://c.ai.ansible.redhat.com"
        );

        let session: AuthenticationSession | undefined = undefined;
        for (var authProvider of getAuthProviderOrder()) {
          session = await vscode.authentication.getSession(authProvider, [], {
            silent: true,
          });
          if (session) {
            break;
          }
        }

        if (!session) {
          await vscode.commands.executeCommand(LIGHTSPEED_AUTH_REQUEST);
        }

        for (var authProvider of getAuthProviderOrder()) {
          session = await vscode.authentication.getSession(authProvider, [], {
            silent: true,
          });
          if (session) {
            break;
          }
        }

        if (!session) {
          await vscode.window.showErrorMessage(
            "vscode-ansible-auth-demo - No active session found!"
          );
          return;
        }

        const responseMe = await fetch(`${lightspeedURL}/api/v0/me`, {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
          },
        });

        const responseToken = await fetch(`${lightspeedURL}/api/v1/me/token/`, {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
          },
        });

        const data = await responseToken.json();
        const wcaEndpoint = data.inference_url;
        const wcaToken = data.bearer_token.access_token;

        const responseWCASpaces = await fetch(`${wcaEndpoint}/v2/spaces`, {
          headers: {
            Authorization: `Bearer ${wcaToken}`
          }
        });
        const spaces = await responseWCASpaces.json();
        const spaceNames = spaces.resources.map((r) => r.entity.name);

        const userMe = (await responseMe.json()) as ILightspeedMe;
        await vscode.window.showInformationMessage(
          `vscode-ansible-auth-demo - Welcome ${userMe.given_name}\nYou have access to the following WCA spaces:\n ${spaceNames}!`
          , { modal: true }
        );



      }
    )
  );
}

// This method is called when your extension is deactivated
export function deactivate() {}
