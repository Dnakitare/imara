import { join } from 'node:path';
import { homedir } from 'node:os';

export const IMARA_HOME = join(homedir(), '.imara');
export const IMARA_CONFIG = join(IMARA_HOME, 'config.json');
export const IMARA_DB = join(IMARA_HOME, 'audit.db');
export const IMARA_POLICIES_DIR = join(IMARA_HOME, 'policies');
export const IMARA_DEFAULT_POLICY = join(IMARA_POLICIES_DIR, 'default.yaml');
export const IMARA_BACKUPS_DIR = join(IMARA_HOME, 'backups');
