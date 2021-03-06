import { QBOAuthCOnfig } from '../../Cloud/QboAuthConfig';
import { MyTimestamp } from '../../firestore/firestoreTypes';
import { deepCopy } from '../../utils/deepCopy';
import { AdminType } from '../admin/AdminType';
import { DaudiMeta } from '../universal/Meta';
import { Metadata } from '../universal/Metadata';

export interface AdminConfig {
  adminTypes: Array<AdminType>;
}

/**
 * This is an initialization variable for the undeletable level for System Admins
 * More levels can be added via db, but these init values are forced to exist
 */
const happy: DaudiMeta = {
  adminId: 'oSGSG2uCQJd3SqpZf6TXObrbDo73',
  date: new Date('Aug 29, 2019')
};

const InfoMetadata: Metadata = {
  created: happy,
  edited: happy
};

export const emptyqboAuth: QBOAuthCOnfig = {
  companyId: 0,
  clientId: '',
  clientSecret: '',
  webhooksVerifier: '',
  authConfig: {
    accessToken: '',
    refreshToken: '',
    createdAt: new Date()
  }
};

export const emptyConfig: AdminConfig = {
  /**
   * Hardcoded this so that the system always has System Admin values
   * Always... Tutatambulikaje???
   */
  adminTypes: [
    {
      description: 'Zero-Q IT Development Team',
      metadata: deepCopy<Metadata>(InfoMetadata),
      name: 'System Admins', levels: [
        {
          description: 'System Developers',
          name: 'Developers',
          metadata: deepCopy<Metadata>(InfoMetadata)
        }
      ]
    }
  ]
};
