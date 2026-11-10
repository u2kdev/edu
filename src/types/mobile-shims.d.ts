// Type shims for mobile packages when typechecking the root project
declare const __DEV__: boolean;

declare module "expo-secure-store" {
  export function setItemAsync(key: string, value: string): Promise<void>;
  export function getItemAsync(key: string): Promise<string | null>;
  export function deleteItemAsync(key: string): Promise<void>;
}

declare module "expo-constants" {
  interface Constants {
    appOwnership?: string;
    executionEnvironment?: string;
    easConfig?: {
      projectId?: string;
    };
    expoConfig?: {
      extra?: {
        eas?: {
          projectId?: string;
        };
      };
    };
  }
  const constants: Constants;
  export default constants;
}

declare module "expo-notifications" {
  export interface NotificationHandler {
    handleNotification: () => Promise<{
      shouldShowAlert: boolean;
      shouldPlaySound: boolean;
      shouldSetBadge: boolean;
    }>;
  }
  export function setNotificationHandler(handler: NotificationHandler): void;
  export function setNotificationChannelAsync(channelId: string, options: unknown): Promise<void>;
  export const AndroidImportance: {
    MAX: number;
    HIGH: number;
    DEFAULT: number;
    LOW: number;
    MIN: number;
    NONE: number;
  };
  export function getPermissionsAsync(): Promise<{ status: string }>;
  export function requestPermissionsAsync(): Promise<{ status: string }>;
  export function getExpoPushTokenAsync(options?: unknown): Promise<{ data: string }>;
}
