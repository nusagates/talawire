import React, { useState, FormEventHandler } from 'react';
import { useForm, usePage } from '@inertiajs/react';
import ActionMessage from '@/Components/ActionMessage';
import ActionSection from '@/Components/ActionSection';
import Checkbox from '@/Components/Checkbox';
import ConfirmationModal from '@/Components/ConfirmationModal';
import DangerButton from '@/Components/DangerButton';
import DialogModal from '@/Components/DialogModal';
import FormSection from '@/Components/FormSection';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import SectionBorder from '@/Components/SectionBorder';
import TextInput from '@/Components/TextInput';
import { PageProps } from '@/types';

interface ApiTokenManagerProps {
    tokens: any[];
    availablePermissions: string[];
    defaultPermissions: string[];
}

export default function ApiTokenManager({
    tokens,
    availablePermissions,
    defaultPermissions,
}: ApiTokenManagerProps) {
    const { jetstream } = usePage<PageProps>().props;

    const createApiTokenForm = useForm({
        name: '',
        permissions: defaultPermissions,
    });

    const updateApiTokenForm = useForm({
        permissions: [] as string[],
    });

    const deleteApiTokenForm = useForm({});

    const [displayingToken, setDisplayingToken] = useState(false);
    const [managingPermissionsFor, setManagingPermissionsFor] = useState<any>(null);
    const [apiTokenBeingDeleted, setApiTokenBeingDeleted] = useState<any>(null);

    const createApiToken: FormEventHandler = (e) => {
        e.preventDefault();
        createApiTokenForm.post(route('api-tokens.store'), {
            preserveScroll: true,
            onSuccess: () => {
                setDisplayingToken(true);
                createApiTokenForm.reset();
            },
        });
    };

    const manageApiTokenPermissions = (token: any) => {
        updateApiTokenForm.setData('permissions', token.abilities);
        setManagingPermissionsFor(token);
    };

    const updateApiToken = () => {
        updateApiTokenForm.put(route('api-tokens.update', managingPermissionsFor.id), {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => setManagingPermissionsFor(null),
        });
    };

    const deleteApiToken = () => {
        deleteApiTokenForm.delete(route('api-tokens.destroy', apiTokenBeingDeleted.id), {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => setApiTokenBeingDeleted(null),
        });
    };

    return (
        <div>
            {/* Generate API Token */}
            <FormSection
                onSubmit={createApiToken}
                title="Create API Token"
                description="API tokens allow third-party services to authenticate with our application on your behalf."
                actions={
                    <>
                        <ActionMessage on={createApiTokenForm.recentlySuccessful} className="me-3">
                            Created.
                        </ActionMessage>

                        <PrimaryButton disabled={createApiTokenForm.processing}>
                            Create
                        </PrimaryButton>
                    </>
                }
            >
                {/* Token Name */}
                <div className="col-span-6 sm:col-span-4">
                    <InputLabel htmlFor="name" value="Name" />
                    <TextInput
                        id="name"
                        type="text"
                        value={createApiTokenForm.data.name}
                        onChange={(e) => createApiTokenForm.setData('name', e.target.value)}
                        className="mt-1 block w-full"
                        autoFocus
                    />
                    <InputError message={createApiTokenForm.errors.name} className="mt-2" />
                </div>

                {/* Token Permissions */}
                {availablePermissions.length > 0 && (
                    <div className="col-span-6">
                        <InputLabel htmlFor="permissions" value="Permissions" />

                        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                            {availablePermissions.map((permission) => (
                                <div key={permission}>
                                    <label className="flex items-center cursor-pointer">
                                        <Checkbox
                                            checked={createApiTokenForm.data.permissions.includes(permission)}
                                            onChange={(e) => {
                                                const checked = e.target.checked;
                                                const current = [...createApiTokenForm.data.permissions];
                                                if (checked) {
                                                    createApiTokenForm.setData('permissions', [...current, permission]);
                                                } else {
                                                    createApiTokenForm.setData(
                                                        'permissions',
                                                        current.filter((p) => p !== permission)
                                                    );
                                                }
                                            }}
                                        />
                                        <span className="ms-2 text-sm text-gray-600">{permission}</span>
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </FormSection>

            {tokens.length > 0 && (
                <div>
                    <SectionBorder />

                    <div className="mt-10 sm:mt-0">
                        <ActionSection
                            title="Manage API Tokens"
                            description="You may delete any of your existing tokens if they are no longer needed."
                        >
                            <div className="space-y-4">
                                {tokens.map((token) => (
                                    <div key={token.id} className="flex items-center justify-between">
                                        <div className="text-sm font-medium text-gray-900">{token.name}</div>

                                        <div className="flex items-center space-x-3 text-xs">
                                            {token.last_used_ago && (
                                                <div className="text-gray-400">
                                                    Last used {token.last_used_ago}
                                                </div>
                                            )}

                                            {availablePermissions.length > 0 && (
                                                <button
                                                    className="underline text-gray-600 hover:text-gray-900 cursor-pointer"
                                                    onClick={() => manageApiTokenPermissions(token)}
                                                >
                                                    Permissions
                                                </button>
                                            )}

                                            <button
                                                className="underline text-red-600 hover:text-red-800 cursor-pointer"
                                                onClick={() => setApiTokenBeingDeleted(token)}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ActionSection>
                    </div>
                </div>
            )}

            {/* Token Value Modal */}
            <DialogModal
                show={displayingToken}
                onClose={() => setDisplayingToken(false)}
                title="API Token"
                content={
                    <div>
                        <p className="text-sm text-gray-600">
                            Please copy your new API token. For your security, it will not be shown again.
                        </p>

                        <div className="mt-4 bg-gray-100 px-4 py-2 rounded-lg font-mono text-sm text-gray-800 break-all select-all">
                            {jetstream?.flash?.token}
                        </div>
                    </div>
                }
                footer={
                    <SecondaryButton onClick={() => setDisplayingToken(false)}>
                        Close
                    </SecondaryButton>
                }
            />

            {/* API Token Permissions Modal */}
            <DialogModal
                show={managingPermissionsFor !== null}
                onClose={() => setManagingPermissionsFor(null)}
                title="API Token Permissions"
                content={
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {availablePermissions.map((permission) => (
                            <div key={permission}>
                                <label className="flex items-center cursor-pointer">
                                    <Checkbox
                                        checked={updateApiTokenForm.data.permissions.includes(permission)}
                                        onChange={(e) => {
                                            const checked = e.target.checked;
                                            const current = [...updateApiTokenForm.data.permissions];
                                            if (checked) {
                                                updateApiTokenForm.setData('permissions', [...current, permission]);
                                            } else {
                                                updateApiTokenForm.setData(
                                                    'permissions',
                                                    current.filter((p) => p !== permission)
                                                );
                                            }
                                        }}
                                    />
                                    <span className="ms-2 text-sm text-gray-600">{permission}</span>
                                </label>
                            </div>
                        ))}
                    </div>
                }
                footer={
                    <>
                        <SecondaryButton onClick={() => setManagingPermissionsFor(null)}>
                            Cancel
                        </SecondaryButton>

                        <PrimaryButton
                            disabled={updateApiTokenForm.processing}
                            onClick={updateApiToken}
                        >
                            Save
                        </PrimaryButton>
                    </>
                }
            />

            {/* Delete Token Confirmation Modal */}
            <ConfirmationModal
                show={apiTokenBeingDeleted !== null}
                onClose={() => setApiTokenBeingDeleted(null)}
                title="Delete API Token"
                content="Are you sure you would like to delete this API token?"
                footer={
                    <>
                        <SecondaryButton onClick={() => setApiTokenBeingDeleted(null)}>
                            Cancel
                        </SecondaryButton>

                        <DangerButton
                            disabled={deleteApiTokenForm.processing}
                            onClick={deleteApiToken}
                        >
                            Delete
                        </DangerButton>
                    </>
                }
            />
        </div>
    );
}
