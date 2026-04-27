import { ActionSheet } from '@/components/ui/action-sheet';
import { ButtonSize, ButtonVariant, ButtonX } from '@/components/ui/buttonx';
import { ModalMask } from '@/components/ui/modal-mask';
import { TextX } from '@/components/ui/textx';
import { View } from '@/components/ui/view';
import { useColor } from '@/hooks/use-color';
import { CORNERS } from '@/theme/globals';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { Aperture, Check, LucideProps, Video, X } from 'lucide-react-native';
import React, { forwardRef, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Pressable, StyleSheet, View as RNView, ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export type MediaType = 'image' | 'video' | 'all';
export type MediaQuality = 'low' | 'medium' | 'high';

export interface MediaAsset {
    id: string;
    uri: string;
    type: 'image' | 'video';
    width?: number;
    height?: number;
    duration?: number;
    filename?: string;
    fileSize?: number;
}

export interface MediaPickerProps {
    children?: React.ReactNode;
    style?: ViewStyle;
    size?: ButtonSize;
    variant?: ButtonVariant;
    icon?: React.ComponentType<LucideProps>;
    disabled?: boolean;
    mediaType?: MediaType;
    multiple?: boolean;
    maxSelection?: number;
    quality?: MediaQuality;
    buttonText?: string;
    placeholder?: string;
    gallery?: boolean;
    showPreview?: boolean;
    previewSize?: number;
    selectedAssets?: MediaAsset[];
    onSelectionChange?: (assets: MediaAsset[]) => void;
    onError?: (error: string) => void;
}

const { width: screenWidth } = Dimensions.get('window');
const GALLERY_CONTENT_DEFER_MS = 280;
const GALLERY_PAGE_SIZE = 90;
const GALLERY_COLUMNS = 3;
const GALLERY_ITEM_MARGIN = 4;
const GALLERY_CONTENT_PADDING = 8;

// Helper function to compare arrays of MediaAssets
const arraysEqual = (a: MediaAsset[], b: MediaAsset[]): boolean => {
    if (a.length !== b.length) return false;
    return a.every((item, index) => {
        const bItem = b[index];
        return item.id === bItem.id && item.uri === bItem.uri && item.type === bItem.type;
    });
};

export const MediaPicker = forwardRef<RNView, MediaPickerProps>(
    (
        {
            children,
            mediaType = 'all',
            multiple = false,
            gallery = false,
            maxSelection = 10,
            quality = 'high',
            onSelectionChange,
            onError,
            buttonText,
            showPreview = true,
            previewSize = 80,
            style,
            variant,
            size,
            icon,
            disabled = false,
            selectedAssets,
        },
        ref,
    ) => {
        const [assets, setAssets] = useState<MediaAsset[]>(selectedAssets ?? []);
        const [draftAssets, setDraftAssets] = useState<MediaAsset[]>([]);
        const [isGalleryVisible, setIsGalleryVisible] = useState(false);
        const [isGalleryContentReady, setIsGalleryContentReady] = useState(false);
        const [isGalleryLoading, setIsGalleryLoading] = useState(false);
        const [isGalleryLoadingMore, setIsGalleryLoadingMore] = useState(false);
        const [hasNextPage, setHasNextPage] = useState(false);
        const [galleryCursor, setGalleryCursor] = useState<string | null>(null);
        const [albums, setAlbums] = useState<MediaLibrary.Album[]>([]);
        const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
        const [isAlbumSheetVisible, setIsAlbumSheetVisible] = useState(false);
        const [galleryAssets, setGalleryAssets] = useState<MediaLibrary.Asset[]>([]);
        const [hasPermission, setHasPermission] = useState<boolean | null>(null);
        const galleryOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
        const galleryRequestIdRef = useRef(0);

        // Use ref to track previous selectedAssets to avoid unnecessary updates
        const prevSelectedAssetsRef = useRef<MediaAsset[]>(selectedAssets ?? []);
        const insets = useSafeAreaInsets();

        // Theme colors
        const cardColor = useColor('card');
        const borderColor = useColor('border');
        const textColor = useColor('text');
        const mutedColor = useColor('mutedForeground');
        const primaryColor = useColor('primary');
        const secondary = useColor('secondary');

        // Request permissions on mount
        useEffect(() => {
            requestPermissions();
        }, []);

        useEffect(() => {
            return () => {
                if (galleryOpenTimerRef.current) {
                    clearTimeout(galleryOpenTimerRef.current);
                    galleryOpenTimerRef.current = null;
                }
            };
        }, []);

        // Update internal state when selectedAssets prop changes (with proper comparison)
        useEffect(() => {
            if (!selectedAssets) {
                return;
            }
            // Only sync when parent actually controls selectedAssets.
            if (!arraysEqual(prevSelectedAssetsRef.current, selectedAssets)) {
                setAssets(selectedAssets);
                prevSelectedAssetsRef.current = selectedAssets;
            }
        }, [selectedAssets]);

        const requestPermissions = async () => {
            try {
                const { status } = await MediaLibrary.requestPermissionsAsync();
                setHasPermission(status === 'granted');

                if (status !== 'granted') {
                    onError?.('Media library permission is required to access photos and videos');
                }
            } catch {
                onError?.('Failed to request permissions');
                setHasPermission(false);
            }
        };

        const loadGalleryAssets = async (
            mode: 'reset' | 'append' = 'reset',
            albumIdOverride?: string | null,
        ): Promise<MediaLibrary.Asset[]> => {
            if (!hasPermission) return [];
            if (mode === 'append' && (!hasNextPage || !galleryCursor || isGalleryLoadingMore)) {
                return [];
            }

            try {
                if (mode === 'append') {
                    setIsGalleryLoadingMore(true);
                }

                const effectiveAlbumId = albumIdOverride === undefined ? selectedAlbumId : albumIdOverride;
                const mediaTypeFilter =
                    mediaType === 'image'
                        ? [MediaLibrary.MediaType.photo]
                        : mediaType === 'video'
                          ? [MediaLibrary.MediaType.video]
                          : [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video];

                const result = await MediaLibrary.getAssetsAsync({
                    first: GALLERY_PAGE_SIZE,
                    after: mode === 'append' ? (galleryCursor ?? undefined) : undefined,
                    album: effectiveAlbumId ?? undefined,
                    mediaType: mediaTypeFilter,
                    sortBy: MediaLibrary.SortBy.creationTime,
                });

                if (mode === 'append') {
                    setGalleryAssets(prev => {
                        const existing = new Set(prev.map(asset => asset.id));
                        const merged = [...prev];
                        result.assets.forEach(asset => {
                            if (!existing.has(asset.id)) {
                                merged.push(asset);
                            }
                        });
                        return merged;
                    });
                } else {
                    setGalleryAssets(result.assets);
                }
                setHasNextPage(result.hasNextPage);
                setGalleryCursor(result.hasNextPage ? result.endCursor : null);
                return result.assets;
            } catch {
                onError?.('Failed to load gallery assets');
                return [];
            } finally {
                if (mode === 'append') {
                    setIsGalleryLoadingMore(false);
                }
            }
        };

        const loadAlbums = async () => {
            if (!hasPermission) return;
            try {
                const list = await MediaLibrary.getAlbumsAsync({
                    includeSmartAlbums: true,
                });
                const validAlbums = list.filter(album => (album.assetCount ?? 0) > 0);
                setAlbums(validAlbums);
            } catch {
                onError?.('Failed to load albums');
            }
        };

        const requestCloseGalleryModal = () => {
            galleryRequestIdRef.current += 1;
            if (galleryOpenTimerRef.current) {
                clearTimeout(galleryOpenTimerRef.current);
                galleryOpenTimerRef.current = null;
            }
            setIsGalleryVisible(false);
        };

        const handleGalleryModalClose = () => {
            setIsGalleryContentReady(false);
            setIsGalleryLoading(false);
            setIsGalleryLoadingMore(false);
            setHasNextPage(false);
            setGalleryCursor(null);
            setGalleryAssets([]);
            setDraftAssets([]);
        };

        const openGalleryModal = () => {
            const requestId = galleryRequestIdRef.current + 1;
            galleryRequestIdRef.current = requestId;
            if (galleryOpenTimerRef.current) {
                clearTimeout(galleryOpenTimerRef.current);
            }

            setIsGalleryVisible(true);
            setDraftAssets(assets);
            setIsGalleryContentReady(false);
            setIsGalleryLoading(true);

            galleryOpenTimerRef.current = setTimeout(async () => {
                if (galleryRequestIdRef.current !== requestId) {
                    return;
                }
                setIsGalleryContentReady(true);
                await Promise.all([loadGalleryAssets('reset'), loadAlbums()]);
                if (galleryRequestIdRef.current !== requestId) {
                    return;
                }
                setIsGalleryLoading(false);
            }, GALLERY_CONTENT_DEFER_MS);
        };

        const pickFromGallery = async () => {
            if (!hasPermission) {
                await requestPermissions();
                return;
            }

            if (gallery) {
                openGalleryModal();
                return;
            }

            try {
                const result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes:
                        mediaType === 'image'
                            ? ImagePicker.MediaTypeOptions.Images
                            : mediaType === 'video'
                              ? ImagePicker.MediaTypeOptions.Videos
                              : ImagePicker.MediaTypeOptions.All,
                    allowsMultipleSelection: multiple,
                    quality: quality === 'high' ? 1 : quality === 'medium' ? 0.7 : 0.3,
                    selectionLimit: multiple ? maxSelection : 1,
                });

                if (!result.canceled && result.assets) {
                    const newAssets = result.assets.map((asset, index) => ({
                        id: `gallery_${Date.now()}_${index}`,
                        uri: asset.uri,
                        type: asset.type === 'video' ? ('video' as const) : ('image' as const),
                        width: asset.width,
                        height: asset.height,
                        duration: asset.duration || undefined,
                        filename: asset.fileName || undefined,
                        fileSize: asset.fileSize,
                    }));

                    handleAssetSelection(newAssets);
                }
            } catch {
                onError?.('Failed to pick media from gallery');
            }
        };

        const handleAssetSelection = (newAssets: MediaAsset[]) => {
            let updatedAssets: MediaAsset[];

            if (multiple) {
                updatedAssets = [...assets, ...newAssets].slice(0, maxSelection);
            } else {
                updatedAssets = newAssets;
            }

            setAssets(updatedAssets);
            prevSelectedAssetsRef.current = updatedAssets; // Update ref to prevent loop
            onSelectionChange?.(updatedAssets);
        };

        const handleGalleryAssetSelect = (galleryAsset: MediaLibrary.Asset) => {
            const newAsset: MediaAsset = {
                id: galleryAsset.id,
                uri: galleryAsset.uri,
                type: galleryAsset.mediaType === MediaLibrary.MediaType.video ? 'video' : 'image',
                width: galleryAsset.width,
                height: galleryAsset.height,
                duration: galleryAsset.duration || undefined,
                filename: galleryAsset.filename,
            };

            setDraftAssets(prevAssets => {
                if (multiple) {
                    const isAlreadySelected = prevAssets.some(asset => asset.id === newAsset.id);

                    if (isAlreadySelected) {
                        return prevAssets.filter(asset => asset.id !== newAsset.id);
                    }
                    if (prevAssets.length < maxSelection) {
                        return [...prevAssets, newAsset];
                    }
                    return prevAssets;
                }

                const isAlreadySelected = prevAssets.some(asset => asset.id === newAsset.id);
                if (isAlreadySelected) {
                    return [];
                }
                return [newAsset];
            });
        };

        const applyDraftSelection = () => {
            setAssets(draftAssets);
            prevSelectedAssetsRef.current = draftAssets;
            onSelectionChange?.(draftAssets);
            requestCloseGalleryModal();
        };

        const handleSelectAlbum = async (albumId: string | null) => {
            setIsAlbumSheetVisible(false);
            setSelectedAlbumId(albumId);
            if (!isGalleryVisible) {
                return;
            }
            setIsGalleryLoading(true);
            await loadGalleryAssets('reset', albumId);
            setIsGalleryLoading(false);
        };

        const handleLoadMore = () => {
            if (!isGalleryContentReady || isGalleryLoading || isGalleryLoadingMore) {
                return;
            }
            if (!hasNextPage || !galleryCursor) {
                return;
            }
            void loadGalleryAssets('append');
        };

        const removeAsset = (assetId: string) => {
            const filteredAssets = assets.filter(asset => asset.id !== assetId);
            setAssets(filteredAssets);
            prevSelectedAssetsRef.current = filteredAssets; // Update ref
            onSelectionChange?.(filteredAssets);
        };

        const renderPreviewItem = ({ item }: { item: MediaAsset }) => (
            <View style={[styles.previewItem, { borderColor }]}>
                <ExpoImage
                    source={{ uri: item.uri }}
                    style={[styles.previewImage, { width: previewSize, height: previewSize }]}
                    contentFit="cover"
                />
                {item.type === 'video' && (
                    <View style={styles.videoIndicator}>
                        <Video size={16} color="white" />
                    </View>
                )}
                <Pressable style={[styles.removeButton, { backgroundColor: primaryColor }]} onPress={() => removeAsset(item.id)}>
                    <X size={12} color={secondary} />
                </Pressable>
            </View>
        );

        const renderGalleryItem = ({ item }: { item: MediaLibrary.Asset }) => {
            const isSelected = draftAssets.some(asset => asset.id === item.id);
            const itemWidth = (screenWidth - GALLERY_CONTENT_PADDING * 2 - GALLERY_ITEM_MARGIN * 2 * GALLERY_COLUMNS) / GALLERY_COLUMNS;

            return (
                <Pressable
                    style={[styles.galleryItem, { width: itemWidth, height: itemWidth }]}
                    onPress={() => handleGalleryAssetSelect(item)}>
                    <ExpoImage source={{ uri: item.uri }} style={styles.galleryImage} contentFit="cover" />
                    {isSelected && <View pointerEvents="none" style={styles.selectedMask} />}
                    {item.mediaType === MediaLibrary.MediaType.video && (
                        <View style={styles.videoIndicator}>
                            <Video size={20} color="white" />
                        </View>
                    )}
                    {isSelected && (
                        <View style={[styles.selectedIndicator, { borderColor: primaryColor }]}>
                            <Check size={14} color={primaryColor} strokeWidth={2.4} />
                        </View>
                    )}
                </Pressable>
            );
        };

        return (
            <>
                <View ref={ref} style={style}>
                    <ButtonX disabled={disabled} variant={variant} size={size} icon={icon} onPress={pickFromGallery}>
                        {buttonText || `Select ${mediaType === 'all' ? 'Media' : mediaType === 'image' ? 'Images' : 'Videos'}`}
                    </ButtonX>

                    {showPreview && assets.length > 0 && (
                        <FlatList
                            data={assets}
                            renderItem={renderPreviewItem}
                            keyExtractor={item => item.id}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.previewContainer}
                            contentContainerStyle={styles.previewContent}
                        />
                    )}

                    {gallery && (
                        <ModalMask
                            isVisible={isGalleryVisible}
                            onPressMask={requestCloseGalleryModal}
                            onClose={handleGalleryModalClose}
                            statusBarTranslucent
                            animationType="none"
                            maskColor="transparent">
                            <SafeAreaView edges={['bottom']} style={[styles.modalContainer, { backgroundColor: cardColor }]}>
                                <View style={[styles.modalHeader, { borderBottomColor: borderColor, paddingTop: 16 + insets.top }]}>
                                    <TextX variant="title">
                                        {buttonText ||
                                            `Select ${mediaType === 'all' ? 'Media' : mediaType === 'image' ? 'Images' : 'Videos'}`}
                                    </TextX>
                                    <ButtonX variant="secondary" icon={Aperture} onPress={() => setIsAlbumSheetVisible(true)} />
                                </View>

                                {!isGalleryContentReady || isGalleryLoading ? (
                                    <View style={styles.galleryLoadingContainer}>
                                        <ActivityIndicator size="small" color={textColor} />
                                        <TextX style={{ color: mutedColor }}>正在加载媒体资源...</TextX>
                                    </View>
                                ) : (
                                    <FlatList
                                        data={galleryAssets}
                                        extraData={draftAssets}
                                        renderItem={renderGalleryItem}
                                        keyExtractor={item => item.id}
                                        numColumns={GALLERY_COLUMNS}
                                        contentContainerStyle={styles.galleryContent}
                                        onEndReachedThreshold={0.5}
                                        onEndReached={handleLoadMore}
                                        ListFooterComponent={
                                            isGalleryLoadingMore ? (
                                                <View style={styles.listFooterLoading}>
                                                    <ActivityIndicator size="small" color={mutedColor} />
                                                </View>
                                            ) : null
                                        }
                                    />
                                )}

                                <View style={[styles.bottomControlBar, { borderTopColor: borderColor, backgroundColor: cardColor }]}>
                                    <ButtonX variant="secondary" onPress={requestCloseGalleryModal}>
                                        取消
                                    </ButtonX>
                                    {multiple ? (
                                        <TextX style={[styles.selectionCount, { color: mutedColor }]}>
                                            {draftAssets.length}/{maxSelection}
                                        </TextX>
                                    ) : (
                                        <View />
                                    )}
                                    <ButtonX variant="primary" onPress={applyDraftSelection}>
                                        确认
                                    </ButtonX>
                                </View>
                            </SafeAreaView>
                        </ModalMask>
                    )}
                </View>
                <ActionSheet
                    visible={isAlbumSheetVisible}
                    onClose={() => setIsAlbumSheetVisible(false)}
                    title="选择相册"
                    options={[
                        {
                            title: '全部相册',
                            onPress: () => {
                                void handleSelectAlbum(null);
                            },
                        },
                        ...albums.map(album => ({
                            title: album.title || '未命名相册',
                            onPress: () => {
                                void handleSelectAlbum(album.id);
                            },
                        })),
                    ]}
                    cancelButtonTitle="取消"
                />
            </>
        );
    },
);

const styles = StyleSheet.create({
    compactButton: {
        width: 60,
        height: 60,
        borderRadius: CORNERS,
        borderWidth: 1,
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
    },

    disabled: {
        opacity: 0.5,
    },

    previewContainer: {
        marginTop: 12,
    },

    previewContent: {
        paddingHorizontal: 4,
    },

    previewItem: {
        marginHorizontal: 4,
        borderRadius: 8,
        borderWidth: 1,
        overflow: 'hidden',
        position: 'relative',
    },

    previewImage: {
        borderRadius: 8,
    },

    videoIndicator: {
        position: 'absolute',
        top: 8,
        left: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        borderRadius: 12,
        padding: 4,
    },

    removeButton: {
        position: 'absolute',
        top: 6,
        right: 6,
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },

    modalContainer: {
        flex: 1,
    },

    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    albumButton: {
        width: 34,
        height: 34,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 999,
        backgroundColor: 'rgba(127,127,127,0.14)',
    },

    selectionCount: {
        fontWeight: '500',
        minWidth: 110,
        textAlign: 'center',
    },

    closeButton: {
        padding: 4,
    },

    galleryContent: {
        paddingHorizontal: GALLERY_CONTENT_PADDING,
        paddingVertical: GALLERY_CONTENT_PADDING,
        paddingBottom: 16,
    },
    galleryLoadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    listFooterLoading: {
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bottomControlBar: {
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },

    galleryItem: {
        margin: GALLERY_ITEM_MARGIN,
        borderRadius: 4,
        overflow: 'hidden',
        position: 'relative',
    },

    galleryImage: {
        width: '100%',
        height: '100%',
    },
    selectedMask: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.28)',
    },

    selectedIndicator: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'white',
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

MediaPicker.displayName = 'MediaPicker';
