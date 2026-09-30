import request from 'supertest';
import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { FamilyMemberModel } from '../../src/models/FamilyMember.js';
import { useTestServer, registerUser } from '../helpers/testServer.js';

async function createPet(app: ReturnType<typeof useTestServer> extends () => infer A ? A : never, token: string) {
  return request(app)
    .post('/api/v1/pets')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Milo', species: 'dog' });
}

describe('pet family access integration', () => {
  const getApp = useTestServer();

  it('creates owner membership, lists shared pets, and hides pets from strangers', async () => {
    const app = getApp();
    const ownerResponse = await registerUser(request, app, 'owner@example.com', 'Owner');
    const owner = ownerResponse.body.data;
    const petResponse = await createPet(app, owner.tokens.accessToken);

    expect(petResponse.status).toBe(201);
    const pet = petResponse.body.data.pet;
    expect(pet.currentUserRole).toBe('owner');
    expect(await FamilyMemberModel.findOne({ petId: pet.id, userId: owner.user.id, role: 'owner' })).not.toBeNull();

    const viewerResponse = await registerUser(request, app, 'viewer@example.com', 'Viewer');
    const viewer = viewerResponse.body.data;
    await FamilyMemberModel.create({
      petId: new Types.ObjectId(pet.id),
      userId: new Types.ObjectId(viewer.user.id),
      role: 'viewer',
    });

    const sharedList = await request(app)
      .get('/api/v1/pets')
      .set('Authorization', `Bearer ${viewer.tokens.accessToken}`);
    expect(sharedList.status).toBe(200);
    expect(sharedList.body.data.pets).toHaveLength(1);
    expect(sharedList.body.data.pets[0].currentUserRole).toBe('viewer');

    const strangerResponse = await registerUser(request, app, 'stranger@example.com', 'Stranger');
    const stranger = strangerResponse.body.data;
    const hiddenPet = await request(app)
      .get(`/api/v1/pets/${pet.id}`)
      .set('Authorization', `Bearer ${stranger.tokens.accessToken}`);
    expect(hiddenPet.status).toBe(404);
    expect(hiddenPet.body.code).toBe('PET_NOT_FOUND');
  });

  it('allows viewer reads but denies writes, and limits admin pet deletion', async () => {
    const app = getApp();
    const ownerResponse = await registerUser(request, app, 'owner@example.com', 'Owner');
    const owner = ownerResponse.body.data;
    const petResponse = await createPet(app, owner.tokens.accessToken);
    const petId = petResponse.body.data.pet.id;

    const reminderResponse = await request(app)
      .post(`/api/v1/pets/${petId}/reminders`)
      .set('Authorization', `Bearer ${owner.tokens.accessToken}`)
      .send({
        title: 'Medication',
        type: 'medication',
        dueAt: '2030-06-10T09:30:00.000Z',
        repeatRule: { kind: 'none' },
      });
    expect(reminderResponse.status).toBe(201);

    const viewerResponse = await registerUser(request, app, 'viewer@example.com', 'Viewer');
    const viewer = viewerResponse.body.data;
    await FamilyMemberModel.create({ petId: petResponse.body.data.pet._id ?? new Types.ObjectId(petId), userId: new Types.ObjectId(viewer.user.id), role: 'viewer' });

    const viewerRead = await request(app)
      .get(`/api/v1/pets/${petId}/reminders`)
      .set('Authorization', `Bearer ${viewer.tokens.accessToken}`);
    expect(viewerRead.status).toBe(200);

    const viewerWrite = await request(app)
      .post(`/api/v1/pets/${petId}/reminders`)
      .set('Authorization', `Bearer ${viewer.tokens.accessToken}`)
      .send({
        title: 'Blocked',
        type: 'custom',
        dueAt: '2030-06-10T09:30:00.000Z',
      });
    expect(viewerWrite.status).toBe(403);
    expect(viewerWrite.body.code).toBe('INSUFFICIENT_PERMISSIONS');

    const caregiverResponse = await registerUser(request, app, 'caregiver@example.com', 'Caregiver');
    const caregiver = caregiverResponse.body.data;
    await FamilyMemberModel.create({ petId: new Types.ObjectId(petId), userId: new Types.ObjectId(caregiver.user.id), role: 'caregiver' });
    const caregiverReminder = await request(app)
      .post(`/api/v1/pets/${petId}/reminders`)
      .set('Authorization', `Bearer ${caregiver.tokens.accessToken}`)
      .send({
        title: 'Caregiver reminder',
        type: 'custom',
        dueAt: '2030-06-10T09:30:00.000Z',
      });
    expect(caregiverReminder.status).toBe(201);
    const caregiverDelete = await request(app)
      .delete(`/api/v1/pets/${petId}/reminders/${caregiverReminder.body.data.reminder.id}`)
      .set('Authorization', `Bearer ${caregiver.tokens.accessToken}`);
    expect(caregiverDelete.status).toBe(403);

    const adminResponse = await registerUser(request, app, 'admin@example.com', 'Admin');
    const admin = adminResponse.body.data;
    await FamilyMemberModel.create({ petId: new Types.ObjectId(petId), userId: new Types.ObjectId(admin.user.id), role: 'admin' });

    const deleteRecord = await request(app)
      .delete(`/api/v1/pets/${petId}/reminders/${reminderResponse.body.data.reminder.id}`)
      .set('Authorization', `Bearer ${admin.tokens.accessToken}`);
    expect(deleteRecord.status).toBe(204);

    const deletePet = await request(app)
      .delete(`/api/v1/pets/${petId}`)
      .set('Authorization', `Bearer ${admin.tokens.accessToken}`);
    expect(deletePet.status).toBe(403);
    expect(deletePet.body.code).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('supports pet update/archive/delete and idempotent invitation acceptance', async () => {
    const app = getApp();
    const ownerResponse = await registerUser(request, app, 'owner@example.com', 'Owner');
    const owner = ownerResponse.body.data;
    const petResponse = await createPet(app, owner.tokens.accessToken);
    const petId = petResponse.body.data.pet.id;

    const updated = await request(app)
      .patch(`/api/v1/pets/${petId}`)
      .set('Authorization', `Bearer ${owner.tokens.accessToken}`)
      .send({ name: 'Milo Jr.' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.pet.name).toBe('Milo Jr.');
    expect(updated.body.data.pet.currentUserRole).toBe('owner');

    const archived = await request(app)
      .post(`/api/v1/pets/${petId}/archive`)
      .set('Authorization', `Bearer ${owner.tokens.accessToken}`);
    expect(archived.status).toBe(200);
    expect(archived.body.data.pet.archivedAt).toEqual(expect.any(String));

    const invitationResponse = await request(app)
      .post(`/api/v1/pets/${petId}/invitations`)
      .set('Authorization', `Bearer ${owner.tokens.accessToken}`)
      .send({ role: 'caregiver' });
    expect(invitationResponse.status).toBe(201);
    const token = invitationResponse.body.data.invitation.inviteUrl.split('/').at(-1);

    const inviteeResponse = await registerUser(request, app, 'invitee@example.com', 'Invitee');
    const invitee = inviteeResponse.body.data;
    const accept = () => request(app)
      .post(`/api/v1/invitations/${token}/accept`)
      .set('Authorization', `Bearer ${invitee.tokens.accessToken}`);
    const firstAccept = await accept();
    expect(firstAccept.status).toBe(200);
    expect(firstAccept.body.data.alreadyMember).toBe(false);
    const repeatedAccept = await accept();
    expect(repeatedAccept.status).toBe(200);
    expect(repeatedAccept.body.data.alreadyMember).toBe(true);

    const deleted = await request(app)
      .delete(`/api/v1/pets/${petId}`)
      .set('Authorization', `Bearer ${owner.tokens.accessToken}`);
    expect(deleted.status).toBe(204);
    const gone = await request(app)
      .get(`/api/v1/pets/${petId}`)
      .set('Authorization', `Bearer ${owner.tokens.accessToken}`);
    expect(gone.status).toBe(404);
  });
});