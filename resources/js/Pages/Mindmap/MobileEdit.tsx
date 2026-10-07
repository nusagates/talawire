import React from 'react';
import Edit from './Edit';
import { Mindmap } from '@/types';

interface MobileEditProps {
    mindmap: Mindmap;
    canEdit?: boolean;
}

export default function MobileEdit(props: MobileEditProps) {
    return <Edit {...props} />;
}
