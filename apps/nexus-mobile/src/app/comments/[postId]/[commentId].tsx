import { useLocalSearchParams } from 'expo-router';
import { CommentConversationScreen } from '../../../screens/CommentConversationScreen';

export default function CommentThreadPage() {
  const { postId, commentId } = useLocalSearchParams<{ postId: string; commentId: string }>();
  const post = Number(postId);
  const comment = Number(commentId);
  return <CommentConversationScreen key={`${post}:${comment}`} postId={Number.isSafeInteger(post) && post > 0 ? post : 0} focusId={Number.isSafeInteger(comment) && comment > 0 ? comment : undefined} />;
}
