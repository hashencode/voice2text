import { ButtonX } from '@/components/ui/buttonx';
import { ModalMask } from '@/components/ui/modal-mask';
import { TextX } from '@/components/ui/textx';
import { View } from '@/components/ui/view';
import { useColor } from '@/hooks/useColor';
import { BORDER_RADIUS } from '@/theme/globals';
import { X } from 'lucide-react-native';
import React from 'react';
import {
  Dimensions,
  Platform,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type SheetSide = 'left' | 'right';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side?: SheetSide;
  children: React.ReactNode;
}

interface SheetContentProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

interface SheetHeaderProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

interface SheetTitleProps {
  children: React.ReactNode;
}

interface SheetDescriptionProps {
  children: React.ReactNode;
}

interface SheetTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
}

interface SheetContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side: SheetSide;
}

const SheetContext = React.createContext<SheetContextValue | null>(null);

const useSheet = () => {
  const context = React.useContext(SheetContext);
  if (!context) {
    throw new Error('Sheet components must be used within a Sheet');
  }
  return context;
};

export function Sheet({
  open,
  onOpenChange,
  side = 'right',
  children,
}: SheetProps) {
  return (
    <SheetContext.Provider value={{ open, onOpenChange, side }}>
      {children}
    </SheetContext.Provider>
  );
}

export function SheetTrigger({ children, asChild }: SheetTriggerProps) {
  const context = React.useContext(SheetContext);

  const handlePress = () => {
    if (context) {
      context.onOpenChange(true);
    }
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onPress: handlePress,
    });
  }

  return <ButtonX onPress={handlePress}>{children}</ButtonX>;
}

export function SheetContent({ children, style }: SheetContentProps) {
  const { open, onOpenChange, side } = useSheet();
  const sheetWidth = Math.min(SCREEN_WIDTH * 0.8, 400);

  const backgroundColor = useColor('background');
  const iconColor = useColor('text');

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <ModalMask
      isVisible={open}
      onPressMask={handleClose}
      statusBarTranslucent
      contentTransitionPreset={side === 'left' ? 'slide-right' : 'slide-left'}
      contentTransitionDistance={sheetWidth}
      contentTransitionDuration={280}
    >
      {/* Sheet */}
      <View
        style={[
          styles.sheet,
          {
            borderRadius: BORDER_RADIUS,
            backgroundColor,
            width: sheetWidth,
            [side]: 0,
          },
          style,
        ]}
      >
          {/* Close button */}
          <TouchableOpacity
            style={[
              styles.closeButton,
              {
                backgroundColor: backgroundColor,
                [side === 'left' ? 'right' : 'left']: 16,
              },
            ]}
            onPress={handleClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={20} color={iconColor} />
          </TouchableOpacity>

          {/* Content */}
          <View style={styles.contentContainer}>{children}</View>
      </View>
    </ModalMask>
  );
}

// Unchanged components below

export function SheetHeader({ children, style }: SheetHeaderProps) {
  return <View style={[styles.header, style]}>{children}</View>;
}

export function SheetTitle({ children }: SheetTitleProps) {
  return (
    <TextX variant='title' style={styles.title}>
      {children}
    </TextX>
  );
}

export function SheetDescription({ children }: SheetDescriptionProps) {
  const mutedColor = useColor('textMuted');

  return (
    <TextX style={[styles.description, { color: mutedColor }]}>{children}</TextX>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    zIndex: 1,
    borderRadius: 999, // Make it circular
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    flex: 1,
  },
  header: {
    paddingTop: 90,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  title: {
    marginBottom: 8,
  },
  description: {
    lineHeight: 20,
  },
});
