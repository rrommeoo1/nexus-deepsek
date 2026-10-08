import { useLocalSearchParams } from 'expo-router';
import { CommentConversationScreen } from '../../../screens/CommentConversationScreen';

export default function CommentsPage() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const id = Number(postId);
  return <CommentConversationScreen key={id} postId={Number.isSafeInteger(id) && id > 0 ? id : 0} />;
}
