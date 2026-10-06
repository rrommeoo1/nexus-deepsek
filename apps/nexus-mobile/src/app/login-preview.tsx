import Constants from 'expo-constants';
import { Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { NexusLandingBrand } from '../components/NexusLandingBrand';
import { NexusLogin } from '../components/NexusLogin';

/** Development-only visual comparison. It never calls authentication endpoints. */
export default function LoginPreviewScreen() {
  if (!__DEV__) return <Redirect href="/" />;
  const previewOnly = () => { throw new Error('Visual QA only: authentication is not mounted here.'); };
  return (
    <View style={{ flex: 1 }} pointerEvents="none">
      <StatusBar hidden />
      <NexusLogin brand={<NexusLandingBrand />} version={`Android ${Constants.expoConfig?.version || 'dev'}`}
        locale="en" googleReady={false} facebookReady={false} walletNetwork="mainnet"
        busy={false} error="" onSignIn={previewOnly} onSignUp={previewOnly}
        onForgotPassword={previewOnly} onXPortal={previewOnly} onProvider={previewOnly} />
    </View>
  );
}
