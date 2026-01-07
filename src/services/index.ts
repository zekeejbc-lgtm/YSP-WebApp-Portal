/**
 * Services Index
 * Central export for all backend services
 */

// Homepage GAS Service
export {
  fetchHomepageContent,
  fetchHomepageContentSafe,
  updateHomepageContent,
  clearHomepageCache,
  getDefaultHomepageContent,
  checkHomepageApiHealth,
  HomepageAPIError,
  type HomepageMainContent,
  type HomepageHeroContent,
  type HomepageAboutContent,
  type HomepageMissionContent,
  type HomepageVisionContent,
  type HomepageAdvocacyPillarsContent,
  type GASError,
  // Homepage_Other (Contact Section) exports
  fetchHomepageOtherContent,
  fetchHomepageOtherContentSafe,
  updateHomepageOtherContent,
  uploadOrgChart,
  addSocialLink,
  removeSocialLink,
  updateSocialLink,
  clearHomepageOtherCache,
  getDefaultHomepageOtherContent,
  type HomepageOtherContent,
  type SocialLinkData,
  // Dev Info (Developer Profile) exports
  fetchDevInfoContent,
  fetchDevInfoContentSafe,
  updateDevInfoContent,
  uploadDevProfile,
  addDevAffiliation,
  removeDevAffiliation,
  updateDevAffiliation,
  addDevSocialLink,
  removeDevSocialLink,
  updateDevSocialLink,
  clearDevInfoCache,
  getDefaultDevInfoContent,
  type DevInfoContent,
  type DevAffiliationData,
  type DevSocialLinkData,
} from './gasHomepageService';
