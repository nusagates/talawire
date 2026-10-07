export interface User {
    id: number;
    name: string;
    email: string;
    email_verified_at?: string;
    profile_photo_path?: string;
    profile_photo_url?: string;
    two_factor_enabled?: boolean;
    all_teams?: Team[];
    current_team?: Team;
    current_team_id?: number;
    [key: string]: any;
}

export interface Team {
    id: number;
    name: string;
    user_id: number;
    personal_team: boolean;
    owner?: User;
    users?: User[];
    [key: string]: any;
}

export interface Project {
    id: number;
    name: string;
    team_id: number;
    mindmaps?: Mindmap[];
    created_at?: string;
    updated_at?: string;
}

export interface MindmapShare {
    id: number;
    mindmap_id: number;
    email: string;
    permission: 'view' | 'edit';
    created_at?: string;
    updated_at?: string;
}

export interface MindmapNodeData {
    label: string;
    emoji?: string;
    theme?: string;
    isRoot?: boolean;
    color?: string;
    bg?: string;
    border?: string;
    shape?: string;
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: string;
    italic?: boolean;
    underline?: boolean;
    strike?: boolean;
    notes?: string;
    link?: string;
    collapsed?: boolean;
    progress?: number;
    priority?: string;
    tags?: string[];
    checklist?: { id: string; text: string; done: boolean }[];
    [key: string]: any;
}

export interface Mindmap {
    id: number;
    uuid?: string;
    name: string;
    project_id: number;
    nodes: any[];
    edges: any[];
    settings?: Record<string, any>;
    is_public: boolean;
    public_permission: 'view' | 'edit';
    video_export_status?: string;
    last_video_url?: string;
    shares?: MindmapShare[];
    created_at?: string;
    updated_at?: string;
}

export type PageProps<T extends Record<string, unknown> = Record<string, unknown>> = T & {
    auth: {
        user: User;
    };
    jetstream?: {
        canCreateTeams?: boolean;
        canManageTwoFactorAuthentication?: boolean;
        canUpdatePassword?: boolean;
        canUpdateProfileInformation?: boolean;
        hasAccountDeletionFeatures?: boolean;
        hasApiFeatures?: boolean;
        hasTeamFeatures?: boolean;
        hasTermsAndPrivacyPolicyFeature?: boolean;
        managesProfilePhotos?: boolean;
        flash?: Record<string, any>;
        [key: string]: any;
    };
    errorBags?: Record<string, any>;
    errors?: Record<string, string>;
};
