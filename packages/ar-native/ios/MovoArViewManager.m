#import <React/RCTViewManager.h>

#if __has_include("MovoArNative/MovoArNative-Swift.h")
#import "MovoArNative/MovoArNative-Swift.h"
#else
#import "MovoArNative-Swift.h"
#endif

/// Legacy view manager (works through the New Architecture interop layer). JS name: MovoArView.
@interface MovoArViewManager : RCTViewManager
@end

@implementation MovoArViewManager

RCT_EXPORT_MODULE(MovoArView)

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

- (UIView *)view
{
  return [[MovoArView alloc] init];
}

RCT_EXPORT_VIEW_PROPERTY(plates, NSString)
RCT_EXPORT_VIEW_PROPERTY(active, BOOL)
RCT_EXPORT_VIEW_PROPERTY(poseHz, double)
RCT_EXPORT_VIEW_PROPERTY(onPose, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onImage, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onTrackingState, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onError, RCTDirectEventBlock)

@end
