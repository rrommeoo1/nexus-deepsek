// SYSTEM_TEST fixtures only. Never call with the owner's database.
import { hashPassword } from '../lib/security.js';
export function seedMessengerLab(repo, { password, avatar = () => null, attachment = () => null }) {
  if (typeof password !== 'string' || password.length < 16) throw new Error('LAB_PASSWORD_REQUIRED');
  if (repo.db.prepare("SELECT count(*) n FROM users WHERE traffic_class != 'SYSTEM_TEST'").get().n) throw new Error('LAB_REFUSES_REAL_USERS');
  const records = [['lab_tester', 'Tu · Test'], ['lab_mira', 'Mira'], ['lab_alex', 'Alex']];
  const users = records.map(([handle, displayName]) => {
    let user = repo.getUserByHandle(handle);
    if (!user) {
      user = repo.createUser({ handle, displayName, passwordHash: hashPassword(password), trafficClass: 'SYSTEM_TEST' });
      repo.db.prepare('UPDATE users SET email = ?, email_verified = 1 WHERE id = ?').run(handle + '@nexus.test', user.id);
      for (const persona of ['social', 'work']) repo.ensurePersona(user.id, persona, { name: displayName, visibility: 'public' });
      const photo = avatar(repo, user);
      if (photo) repo.updatePersona(user.id, 'social', { avatar: photo });
    }
    return user;
  });
  const [tester, mira, alex] = users;
  const send = (conversation, sender, body, index, media = null) => repo.sendConversationMessage({
    conversationId: conversation.id, senderId: sender.id, senderPersona: conversation.context_persona,
    body, kind: media ? 'image' : 'text', attachmentMediaId: media?.id ?? null, clientNonce: `lab:${conversation.id}:${index}`,
  });
  for (const peer of [mira, alex]) {
    const conversation = repo.createDirectConversation({ creatorId: tester.id, recipientId: peer.id, contextPersona: 'social' });
    for (const [i, line] of ['Bună! Aici putem testa conversația.', 'Perfect. Încerc și camera, apoi o notă vocală.', 'Mesajele trimise aici se păstrează. Ne auzim?'].entries()) {
      if (!send(conversation, i === 1 ? tester : peer, line, i)) throw new Error('LAB_MESSAGE_FAILED');
    }
    const photo = attachment(repo, peer);
    if (photo && !send(conversation, peer, 'Fotografie de test · persoană fictivă', 3, photo)) throw new Error('LAB_ATTACHMENT_FAILED');
  }
  const work = repo.createDirectConversation({ creatorId: tester.id, recipientId: mira.id, contextPersona: 'work' });
  send(work, mira, 'Acesta este firul Work. Mesajele Social rămân separate.', 0);
  const title = 'Weekend · Test';
  const existing = repo.listUnifiedConversations(tester.id, { persona: 'social' }).find((c) => c.kind === 'group' && c.title === title);
  const group = existing || repo.createGroupConversation({ creatorId: tester.id, memberIds: [mira.id, alex.id], title, contextPersona: 'social' });
  if (!existing) for (const user of [mira, alex]) repo.decideGroupInvitation(group.id, user.id, 'accept');
  send(group, mira, 'Unde mergem sâmbătă?', 0); send(group, alex, 'Eu votez pentru munte 🌿', 1); send(group, tester, 'Vin și eu!', 2);
  return { users: users.map((u) => ({ handle: u.handle, email: u.handle + '@nexus.test' })), conversations: 4, automated_delivery: false };
}
