export const assertSafeTestDatabase = ({
  nodeEnv,
  databaseName,
  developmentDatabaseName,
}) => {
  if (nodeEnv !== 'test') {
    throw new Error('Destructive test database setup requires NODE_ENV=test.');
  }

  if (!databaseName || !databaseName.toLowerCase().includes('test')) {
    throw new Error('The integration database name must explicitly identify a test database.');
  }

  if (databaseName === developmentDatabaseName) {
    throw new Error('The integration database must differ from the development database.');
  }
};

