/**
 * Services Index
 * Central export for all backend services
 */

// Homepage GAS Service
export {
  fetchHomepageContent,
  updateHomepageContent,
  clearHomepageCache,
  getDefaultHomepageContent,
  checkHomepageApiHealth,
  type HomepageMainContent,
  type HomepageHeroContent,
  type HomepageAboutContent,
  type HomepageMissionContent,
  type HomepageVisionContent,
  type HomepageAdvocacyPillarsContent,
} from './gasHomepageService';
