import type {
  CardOffice,
  CardProductResponse,
  ProfileThemePalette,
  PublicProfileApi,
} from '@nfc/shared';

export interface ProfileTemplateViewModel {
  profile: PublicProfileApi;
  palette: ProfileThemePalette;
  office: CardOffice | null;
  products: CardProductResponse[];
  socialLinks: PublicProfileApi['socialLinks'];
  sections: {
    contact: boolean;
    social: boolean;
    gallery: boolean;
    office: boolean;
    products: boolean;
  };
}

export interface ProfileTemplateActions {
  downloadContact: () => void;
  downloadCsv: () => void;
  qrDataUrl: string;
  qrError: string;
}

export interface PublicProfileTemplateProps {
  viewModel: ProfileTemplateViewModel;
  actions: ProfileTemplateActions;
}
