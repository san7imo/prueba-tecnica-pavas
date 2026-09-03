import { QueryTypes } from 'sequelize';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?\d{7,20}$/;

const normalizeEmail = (value) => value.trim().toLowerCase();
const normalizePhone = (value) => value.trim().replace(/[\s\-.()]/g, '');

const invalidFields = (client) => {
  const fields = [];
  const phone = normalizePhone(client.phone);
  if (!PHONE_PATTERN.test(phone)) fields.push('phone');

  let email = null;
  if (client.email !== null) {
    email = normalizeEmail(client.email);
    if (email.length === 0 || email.length > 254 || !EMAIL_PATTERN.test(email)) {
      fields.push('email');
    }
  }

  return { fields, phone, email };
};

const preflightError = (invalidClients) => {
  const diagnostics = invalidClients
    .map(({ id, fields }) => `client ${id} [${fields.join(', ')}]`)
    .join('; ');
  return new Error(
    `Client contact normalization aborted. Fix invalid persisted fields and rerun: ${diagnostics}.`,
  );
};

export const up = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async (transaction) => {
    const clients = await queryInterface.sequelize.query(
      `SELECT id, phone, email
       FROM clients
       ORDER BY id ASC`,
      { type: QueryTypes.SELECT, transaction },
    );
    const normalizedClients = clients.map((client) => ({
      id: client.id,
      ...invalidFields(client),
    }));
    const invalidClients = normalizedClients.filter(
      ({ fields }) => fields.length > 0,
    );
    if (invalidClients.length > 0) throw preflightError(invalidClients);

    for (const client of normalizedClients) {
      await queryInterface.sequelize.query(
        `UPDATE clients
         SET phone = :phone, email = :email
         WHERE id = :id`,
        {
          replacements: {
            id: client.id,
            phone: client.phone,
            email: client.email,
          },
          transaction,
        },
      );
    }
  });
};

export const down = async () => {
  // Data-only canonicalization is intentionally irreversible: punctuation and
  // email casing cannot be reconstructed without inventing persisted values.
};
