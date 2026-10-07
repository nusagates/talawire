import React from 'react';
import { Link } from '@inertiajs/react';
import ApplicationLogo from './ApplicationLogo';

export default function AuthenticationCardLogo() {
    return (
        <Link href="/">
            <ApplicationLogo />
        </Link>
    );
}
