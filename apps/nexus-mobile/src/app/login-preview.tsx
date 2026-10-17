import { Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { NexusLandingBrand } from '../components/NexusLandingBrand';
import { NexusLogin } from '../components/NexusLogin';
import { JungleBackdrop } from '../components/JungleBackdrop';

/** Development-only visual comparison. It never calls authentication endpoints. */
export default function LoginPreviewScreen() {
  if (!__DEV__) return <Redirect href="/" />;
  const previewOnly = () => { throw new Error('Visual QA only: authentication is not mounted here.'); };
  return (
    <View style={{ flex: 1 }} pointerEvents="none">
      <StatusBar hidden />
      <JungleBackdrop opacity={0.12} anchor="bottom" />
      <NexusLogin brand={<NexusLandingBrand />}
        locale="en" googleReady={false} facebookReady={false} walletNetwork="mainnet"
        busy={false} error="" onSignIn={previewOnly} onSignUp={previewOnly}
        onForgotPassword={previewOnly} onXPortal={previewOnly} onProvider={previewOnly} />
    </View>
  );
}
