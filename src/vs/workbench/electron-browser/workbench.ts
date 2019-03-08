/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/workbench/browser/style';

import { localize } from 'vs/nls';
import { setFileNameComparer } from 'vs/base/common/comparers';
import { IDisposable, dispose, Disposable } from 'vs/base/common/lifecycle';
import { Event, Emitter, setGlobalLeakWarningThreshold } from 'vs/base/common/event';
import { EventType, addDisposableListener, addClasses, addClass, removeClass, isAncestor, getClientArea, position, size, removeClasses } from 'vs/base/browser/dom';
import { runWhenIdle, IdleValue } from 'vs/base/common/async';
import { getZoomLevel, onDidChangeFullscreen, isFullscreen, getZoomFactor } from 'vs/base/browser/browser';
import { mark } from 'vs/base/common/performance';
import { onUnexpectedError, setUnexpectedErrorHandler } from 'vs/base/common/errors';
import { IBackupFileService } from 'vs/workbench/services/backup/common/backup';
import { Registry } from 'vs/platform/registry/common/platform';
import { isWindows, isLinux, isMacintosh } from 'vs/base/common/platform';
import { IResourceInput } from 'vs/platform/editor/common/editor';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';
import { IEditorInputFactoryRegistry, Extensions as EditorExtensions, IUntitledResourceInput, IResourceDiffInput } from 'vs/workbench/common/editor';
import { ActivitybarPart } from 'vs/workbench/browser/parts/activitybar/activitybarPart';
import { SidebarPart } from 'vs/workbench/browser/parts/sidebar/sidebarPart';
import { PanelPart } from 'vs/workbench/browser/parts/panel/panelPart';
import { StatusbarPart } from 'vs/workbench/browser/parts/statusbar/statusbarPart';
import { TitlebarPart } from 'vs/workbench/browser/parts/titlebar/titlebarPart';
import { EditorPart } from 'vs/workbench/browser/parts/editor/editorPart';
import { IActionBarRegistry, Extensions as ActionBarExtensions } from 'vs/workbench/browser/actions';
import { PanelRegistry, Extensions as PanelExtensions } from 'vs/workbench/browser/panel';
import { ViewletRegistry, Extensions as ViewletExtensions } from 'vs/workbench/browser/viewlet';
import { QuickOpenController } from 'vs/workbench/browser/parts/quickopen/quickOpenController';
import { IQuickInputService } from 'vs/platform/quickinput/common/quickInput';
import { QuickInputService } from 'vs/workbench/browser/parts/quickinput/quickInput';
import { getServices } from 'vs/platform/instantiation/common/extensions';
import { Position, Parts, IPartService, ILayoutOptions } from 'vs/workbench/services/part/common/partService';
import { IWorkspaceContextService, WorkbenchState } from 'vs/platform/workspace/common/workspace';
import { IStorageService, StorageScope, IWillSaveStateEvent, WillSaveStateReason } from 'vs/platform/storage/common/storage';
import { ContextMenuService as HTMLContextMenuService } from 'vs/platform/contextview/browser/contextMenuService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ContextKeyService } from 'vs/platform/contextkey/browser/contextKeyService';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IActivityService } from 'vs/workbench/services/activity/common/activity';
import { IViewletService } from 'vs/workbench/services/viewlet/browser/viewlet';
import { IFileService } from 'vs/platform/files/common/files';
import { IPanelService } from 'vs/workbench/services/panel/common/panelService';
import { ITitleService } from 'vs/workbench/services/title/common/titleService';
import { IQuickOpenService } from 'vs/platform/quickOpen/common/quickOpen';
import { IHistoryService } from 'vs/workbench/services/history/common/history';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { LifecyclePhase, StartupKind, ILifecycleService, WillShutdownEvent } from 'vs/platform/lifecycle/common/lifecycle';
import { IWindowService, IWindowConfiguration, IPath, MenuBarVisibility, getTitleBarStyle, IWindowsService } from 'vs/platform/windows/common/windows';
import { IStatusbarService } from 'vs/platform/statusbar/common/statusbar';
import { IContextMenuService, IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { ActivityService } from 'vs/workbench/services/activity/browser/activityService';
import { IViewsService } from 'vs/workbench/common/views';
import { ViewsService } from 'vs/workbench/browser/parts/views/views';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { NotificationService } from 'vs/workbench/services/notification/common/notificationService';
import { NotificationsCenter } from 'vs/workbench/browser/parts/notifications/notificationsCenter';
import { NotificationsAlerts } from 'vs/workbench/browser/parts/notifications/notificationsAlerts';
import { NotificationsStatus } from 'vs/workbench/browser/parts/notifications/notificationsStatus';
import { registerNotificationCommands } from 'vs/workbench/browser/parts/notifications/notificationsCommands';
import { NotificationsToasts } from 'vs/workbench/browser/parts/notifications/notificationsToasts';
import { IEditorService, IResourceEditor } from 'vs/workbench/services/editor/common/editorService';
import { IEditorGroupsService } from 'vs/workbench/services/editor/common/editorGroupsService';
import { EditorService } from 'vs/workbench/services/editor/browser/editorService';
import { ContextViewService } from 'vs/platform/contextview/browser/contextViewService';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { Sizing, Direction, Grid, View } from 'vs/base/browser/ui/grid/grid';
import { WorkbenchLegacyLayout } from 'vs/workbench/browser/legacyLayout';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { setARIAContainer } from 'vs/base/browser/ui/aria/aria';
import { restoreFontInfo, readFontInfo, saveFontInfo } from 'vs/editor/browser/config/configuration';
import { BareFontInfo } from 'vs/editor/common/config/fontInfo';
import { ILogService } from 'vs/platform/log/common/log';
import { toErrorMessage } from 'vs/base/common/errorMessage';
import { ILabelService } from 'vs/platform/label/common/label';
import { LabelService } from 'vs/workbench/services/label/common/labelService';
import { ITelemetryServiceConfig, TelemetryService } from 'vs/platform/telemetry/common/telemetryService';
import { combinedAppender, LogAppender, NullTelemetryService } from 'vs/platform/telemetry/common/telemetryUtils';
import { IExtensionGalleryService, IExtensionManagementServerService, IExtensionManagementService, IExtensionEnablementService } from 'vs/platform/extensionManagement/common/extensionManagement';
import { IRemoteAuthorityResolverService } from 'vs/platform/remote/common/remoteAuthorityResolver';
import { ExtensionEnablementService } from 'vs/platform/extensionManagement/common/extensionEnablementService';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { CommandService } from 'vs/workbench/services/commands/common/commandService';
import { IModeService } from 'vs/editor/common/services/modeService';
import { WorkbenchModeServiceImpl } from 'vs/workbench/services/mode/common/workbenchModeService';
import { ITextResourceConfigurationService, ITextResourcePropertiesService } from 'vs/editor/common/services/resourceConfiguration';
import { TextResourceConfigurationService } from 'vs/editor/common/services/resourceConfigurationImpl';
import { IModelService } from 'vs/editor/common/services/modelService';
import { ModelServiceImpl } from 'vs/editor/common/services/modelServiceImpl';
import { IUntitledEditorService, UntitledEditorService } from 'vs/workbench/services/untitled/common/untitledEditorService';
import { ILocalizationsService } from 'vs/platform/localizations/common/localizations';
import { HistoryService } from 'vs/workbench/services/history/browser/history';
import { WorkbenchThemeService } from 'vs/workbench/services/themes/browser/workbenchThemeService';
import { IProductService } from 'vs/platform/product/common/product';
import { IAccessibilityService } from 'vs/platform/accessibility/common/accessibility';
import { WorkbenchContextKeysHandler } from 'vs/workbench/browser/contextkeys';
import { ServicesAccessor } from 'vs/editor/browser/editorExtensions';

// import@node
import { getDelayedChannel } from 'vs/base/parts/ipc/node/ipc';
import { connect as connectNet } from 'vs/base/parts/ipc/node/ipc.net';
import { DialogChannel } from 'vs/platform/dialogs/node/dialogIpc';
import { TelemetryAppenderClient } from 'vs/platform/telemetry/node/telemetryIpc';
import { resolveWorkbenchCommonProperties } from 'vs/platform/telemetry/node/workbenchCommonProperties';
import { IRequestService } from 'vs/platform/request/node/request';
import { ExtensionGalleryService } from 'vs/platform/extensionManagement/node/extensionGalleryService';
import { IRemoteAgentService } from 'vs/workbench/services/remote/node/remoteAgentService';
import { DownloadServiceChannel } from 'vs/platform/download/node/downloadIpc';
import { LogLevelSetterChannel } from 'vs/platform/log/node/logIpc';
import { ExtensionManagementChannelClient } from 'vs/platform/extensionManagement/node/extensionManagementIpc';
import { ExtensionManagementServerService } from 'vs/workbench/services/extensions/node/extensionManagementServerService';
import { MultiExtensionManagementService } from 'vs/workbench/services/extensionManagement/node/multiExtensionManagement';
import { LocalizationsChannelClient } from 'vs/platform/localizations/node/localizationsIpc';
import { AccessibilityService } from 'vs/platform/accessibility/node/accessibilityService';
import { ProductService } from 'vs/platform/product/node/productService';
import { TextResourcePropertiesService } from 'vs/workbench/services/textfile/node/textResourcePropertiesService';
import { RemoteFileService } from 'vs/workbench/services/files/node/remoteFileService';

// import@electron-browser
import { ContextMenuService as NativeContextMenuService } from 'vs/workbench/services/contextmenu/electron-browser/contextmenuService';
import { WorkbenchKeybindingService } from 'vs/workbench/services/keybinding/electron-browser/keybindingService';
import { LifecycleService } from 'vs/platform/lifecycle/electron-browser/lifecycleService';
import { WindowService } from 'vs/platform/windows/electron-browser/windowService';
import { RemoteAuthorityResolverService } from 'vs/platform/remote/electron-browser/remoteAuthorityResolverService';
import { RemoteAgentService } from 'vs/workbench/services/remote/electron-browser/remoteAgentServiceImpl';
import { ExtensionService } from 'vs/workbench/services/extensions/electron-browser/extensionService';
import { RequestService } from 'vs/platform/request/electron-browser/requestService';

enum Identifiers {
	TITLEBAR_PART = 'workbench.parts.titlebar',
	ACTIVITYBAR_PART = 'workbench.parts.activitybar',
	SIDEBAR_PART = 'workbench.parts.sidebar',
	PANEL_PART = 'workbench.parts.panel',
	EDITOR_PART = 'workbench.parts.editor',
	STATUSBAR_PART = 'workbench.parts.statusbar'
}

enum Settings {
	MENUBAR_VISIBLE = 'window.menuBarVisibility',
	ACTIVITYBAR_VISIBLE = 'workbench.activityBar.visible',
	STATUSBAR_VISIBLE = 'workbench.statusBar.visible',

	SIDEBAR_POSITION = 'workbench.sideBar.location',
	PANEL_POSITION = 'workbench.panel.defaultLocation',

	FONT_ALIASING = 'workbench.fontAliasing',
	ZEN_MODE_RESTORE = 'zenMode.restore'
}

enum Storage {
	SIDEBAR_HIDDEN = 'workbench.sidebar.hidden',

	PANEL_HIDDEN = 'workbench.panel.hidden',
	PANEL_POSITION = 'workbench.panel.location',

	ZEN_MODE_ENABLED = 'workbench.zenmode.active',
	CENTERED_LAYOUT_ENABLED = 'workbench.centerededitorlayout.active',
}

export class Workbench extends Disposable implements IPartService {

	//#region workbench

	_serviceBrand: any;

	private readonly _onShutdown = this._register(new Emitter<void>());
	get onShutdown(): Event<void> { return this._onShutdown.event; }

	private readonly _onWillShutdown = this._register(new Emitter<WillShutdownEvent>());
	get onWillShutdown(): Event<WillShutdownEvent> { return this._onWillShutdown.event; }

	private previousErrorValue: string;
	private previousErrorTime = 0;

	private workbench: HTMLElement;

	private restored: boolean;
	private disposed: boolean;

	private editorService: EditorService;
	private editorGroupService: IEditorGroupsService;
	private contextViewService: ContextViewService;
	private windowService: IWindowService;

	private instantiationService: IInstantiationService;
	private contextService: IWorkspaceContextService;
	private storageService: IStorageService;
	private configurationService: IConfigurationService;
	private environmentService: IEnvironmentService;
	private logService: ILogService;
	private windowsService: IWindowsService;

	private titlebarPart: TitlebarPart;
	private activitybarPart: ActivitybarPart;
	private sidebarPart: SidebarPart;
	private panelPart: PanelPart;
	private editorPart: EditorPart;
	private statusbarPart: StatusbarPart;

	private quickOpen: QuickOpenController;
	private quickInput: QuickInputService;

	private notificationsCenter: NotificationsCenter;
	private notificationsToasts: NotificationsToasts;

	constructor(
		private container: HTMLElement,
		private configuration: IWindowConfiguration,
		private serviceCollection: ServiceCollection,
		@IInstantiationService instantiationService: IInstantiationService,
		@IWorkspaceContextService contextService: IWorkspaceContextService,
		@IStorageService storageService: IStorageService,
		@IConfigurationService configurationService: IConfigurationService,
		@IEnvironmentService environmentService: IEnvironmentService,
		@ILogService logService: ILogService,
		@IWindowsService windowsService: IWindowsService
	) {
		super();

		this.instantiationService = instantiationService;
		this.contextService = contextService;
		this.storageService = storageService;
		this.configurationService = configurationService;
		this.environmentService = environmentService;
		this.logService = logService;
		this.windowsService = windowsService;

		this.registerErrorHandler();
	}

	private registerErrorHandler(): void {

		// Listen on unhandled rejection events
		window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {

			// See https://developer.mozilla.org/en-US/docs/Web/API/PromiseRejectionEvent
			onUnexpectedError(event.reason);

			// Prevent the printing of this event to the console
			event.preventDefault();
		});

		// Install handler for unexpected errors
		setUnexpectedErrorHandler(error => this.handleUnexpectedError(error));

		// Inform user about loading issues from the loader
		(<any>self).require.config({
			onError: err => {
				if (err.errorCode === 'load') {
					onUnexpectedError(new Error(localize('loaderErrorNative', "Failed to load a required file. Please restart the application to try again. Details: {0}", JSON.stringify(err))));
				}
			}
		});
	}

	private handleUnexpectedError(error: any): void {
		const errorMsg = toErrorMessage(error, true);
		if (!errorMsg) {
			return;
		}

		const now = Date.now();
		if (errorMsg === this.previousErrorValue && now - this.previousErrorTime <= 1000) {
			return; // Return if error message identical to previous and shorter than 1 second
		}

		this.previousErrorTime = now;
		this.previousErrorValue = errorMsg;

		// Log it
		this.logService.error(errorMsg);
	}

	startup(): void {
		try {
			this.doStartup().then(undefined, error => this.logService.error(toErrorMessage(error, true)));
		} catch (error) {
			this.logService.error(toErrorMessage(error, true));

			throw error; // rethrow because this is a critical issue we cannot handle properly here
		}
	}

	private doStartup(): Promise<void> {

		// Logging
		this.logService.trace('workbench configuration', JSON.stringify(this.configuration));

		// Configure emitter leak warning threshold
		setGlobalLeakWarningThreshold(175);

		// Setup Intl for comparers
		setFileNameComparer(new IdleValue(() => {
			const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
			return {
				collator: collator,
				collatorIsNumeric: collator.resolvedOptions().numeric
			};
		}));

		// ARIA
		setARIAContainer(document.body);

		// Warm up font cache information before building up too many dom elements
		restoreFontInfo(this.storageService);
		readFontInfo(BareFontInfo.createFromRawSettings(this.configurationService.getValue('editor'), getZoomLevel()));

		// Create Workbench Container
		this.createWorkbenchContainer();

		// Services
		this.initServices(this.serviceCollection);

		// Registries
		this.startRegistries();

		// Context Keys
		this._register(this.instantiationService.createInstance(WorkbenchContextKeysHandler));

		// Register Listeners
		this.registerListeners();
		this.registerLayoutListeners();

		// Layout State
		this.instantiationService.invokeFunction(accessor => this.initLayoutState(accessor));

		// Render Workbench
		this.renderWorkbench();

		// Workbench Layout
		this.createWorkbenchLayout();

		// Layout
		this.layout();

		// Restore
		return this.restoreWorkbench();
	}

	private createWorkbenchContainer(): void {
		this.workbench = document.createElement('div');

		const platformClass = isWindows ? 'windows' : isLinux ? 'linux' : 'mac';

		addClasses(this.workbench, 'monaco-workbench', platformClass);
		addClasses(document.body, platformClass); // used by our fonts
	}

	private initServices(serviceCollection: ServiceCollection): void {

		// Parts
		serviceCollection.set(IPartService, this);

		// Labels
		serviceCollection.set(ILabelService, new SyncDescriptor(LabelService, undefined, true));

		// Notifications
		serviceCollection.set(INotificationService, new SyncDescriptor(NotificationService, undefined, true));

		// Window
		this.windowService = this.instantiationService.createInstance(WindowService, this.configuration);
		serviceCollection.set(IWindowService, this.windowService);

		// Product
		const productService = new ProductService();
		serviceCollection.set(IProductService, productService);

		// Shared Process
		const sharedProcess = this.windowsService.whenSharedProcessReady()
			.then(() => connectNet(this.environmentService.sharedIPCHandle, `window:${this.configuration.windowId}`))
			.then(client => {
				client.registerChannel('dialog', this.instantiationService.createInstance(DialogChannel));

				return client;
			});

		// Telemetry
		let telemetryService: ITelemetryService;
		if (!this.environmentService.isExtensionDevelopment && !this.environmentService.args['disable-telemetry'] && !!productService.enableTelemetry) {
			const channel = getDelayedChannel(sharedProcess.then(c => c.getChannel('telemetryAppender')));
			const config: ITelemetryServiceConfig = {
				appender: combinedAppender(new TelemetryAppenderClient(channel), new LogAppender(this.logService)),
				commonProperties: resolveWorkbenchCommonProperties(this.storageService, productService.commit, productService.version, this.configuration.machineId, this.environmentService.installSourcePath),
				piiPaths: [this.environmentService.appRoot, this.environmentService.extensionsPath]
			};

			telemetryService = this._register(this.instantiationService.createInstance(TelemetryService, config));
		} else {
			telemetryService = NullTelemetryService;
		}

		serviceCollection.set(ITelemetryService, telemetryService);

		// Lifecycle
		const lifecycleService = this.instantiationService.createInstance(LifecycleService);
		serviceCollection.set(ILifecycleService, lifecycleService);
		this._register(lifecycleService.onWillShutdown(event => this._onWillShutdown.fire(event)));
		this._register(lifecycleService.onShutdown(() => {
			this._onShutdown.fire();
			this.dispose();
		}));

		// Request Service
		serviceCollection.set(IRequestService, new SyncDescriptor(RequestService, undefined, true));

		// Extension Gallery
		serviceCollection.set(IExtensionGalleryService, new SyncDescriptor(ExtensionGalleryService, undefined, true));

		// Remote Resolver
		serviceCollection.set(IRemoteAuthorityResolverService, new SyncDescriptor(RemoteAuthorityResolverService, undefined, true));

		// Remote Agent
		serviceCollection.set(IRemoteAgentService, new SyncDescriptor(RemoteAgentService, [this.configuration]));

		// Extensions Management
		const extensionManagementChannel = getDelayedChannel(sharedProcess.then(c => c.getChannel('extensions')));
		const extensionManagementChannelClient = new ExtensionManagementChannelClient(extensionManagementChannel);
		serviceCollection.set(IExtensionManagementServerService, new SyncDescriptor(ExtensionManagementServerService, [extensionManagementChannelClient]));
		serviceCollection.set(IExtensionManagementService, new SyncDescriptor(MultiExtensionManagementService));

		// Extension Enablement
		serviceCollection.set(IExtensionEnablementService, new SyncDescriptor(ExtensionEnablementService, undefined, true));

		// Extensions
		serviceCollection.set(IExtensionService, new SyncDescriptor(ExtensionService));

		// Theming
		serviceCollection.set(IWorkbenchThemeService, new SyncDescriptor(WorkbenchThemeService, [document.body]));

		// Commands
		serviceCollection.set(ICommandService, new SyncDescriptor(CommandService, undefined, true));

		// Editor Mode
		serviceCollection.set(IModeService, new SyncDescriptor(WorkbenchModeServiceImpl));

		// Text Resource Config
		serviceCollection.set(ITextResourceConfigurationService, new SyncDescriptor(TextResourceConfigurationService));

		// Text Resource Properties
		serviceCollection.set(ITextResourcePropertiesService, new SyncDescriptor(TextResourcePropertiesService));

		// Editor Models
		serviceCollection.set(IModelService, new SyncDescriptor(ModelServiceImpl, undefined, true));

		// Untitled Editors
		serviceCollection.set(IUntitledEditorService, new SyncDescriptor(UntitledEditorService, undefined, true));

		// Localization
		const localizationsChannel = getDelayedChannel(sharedProcess.then(c => c.getChannel('localizations')));
		serviceCollection.set(ILocalizationsService, new SyncDescriptor(LocalizationsChannelClient, [localizationsChannel]));

		// Status bar
		this.statusbarPart = this.instantiationService.createInstance(StatusbarPart, Identifiers.STATUSBAR_PART);
		serviceCollection.set(IStatusbarService, this.statusbarPart);

		// Context Keys
		serviceCollection.set(IContextKeyService, new SyncDescriptor(ContextKeyService));

		// Keybindings
		serviceCollection.set(IKeybindingService, new SyncDescriptor(WorkbenchKeybindingService, [window]));

		// Context view service
		this.contextViewService = this.instantiationService.createInstance(ContextViewService, this.workbench);
		serviceCollection.set(IContextViewService, this.contextViewService);

		// Use themable context menus when custom titlebar is enabled to match custom menubar
		if (!isMacintosh && getTitleBarStyle(this.configurationService, this.environmentService) === 'custom') {
			serviceCollection.set(IContextMenuService, new SyncDescriptor(HTMLContextMenuService, [null]));
		} else {
			serviceCollection.set(IContextMenuService, new SyncDescriptor(NativeContextMenuService));
		}

		// Sidebar part
		this.sidebarPart = this.instantiationService.createInstance(SidebarPart, Identifiers.SIDEBAR_PART);

		// Viewlet service
		serviceCollection.set(IViewletService, this.sidebarPart);

		// Panel service (panel part)
		this.panelPart = this.instantiationService.createInstance(PanelPart, Identifiers.PANEL_PART);
		serviceCollection.set(IPanelService, this.panelPart);

		// Views service
		serviceCollection.set(IViewsService, new SyncDescriptor(ViewsService));

		// Activity service (activitybar part)
		this.activitybarPart = this.instantiationService.createInstance(ActivitybarPart, Identifiers.ACTIVITYBAR_PART);
		serviceCollection.set(IActivityService, new SyncDescriptor(ActivityService, [this.activitybarPart, this.panelPart], true));

		// File Service
		serviceCollection.set(IFileService, new SyncDescriptor(RemoteFileService));

		// Editor and Group services
		this.editorPart = this.instantiationService.createInstance(EditorPart, Identifiers.EDITOR_PART, !this.hasInitialFilesToOpen());
		this.editorGroupService = this.editorPart;
		serviceCollection.set(IEditorGroupsService, this.editorPart);
		this.editorService = this.instantiationService.createInstance(EditorService);
		serviceCollection.set(IEditorService, this.editorService);

		// Accessibility
		serviceCollection.set(IAccessibilityService, new SyncDescriptor(AccessibilityService, undefined, true));

		// Title bar
		this.titlebarPart = this.instantiationService.createInstance(TitlebarPart, Identifiers.TITLEBAR_PART);
		serviceCollection.set(ITitleService, this.titlebarPart);

		// History
		serviceCollection.set(IHistoryService, new SyncDescriptor(HistoryService));

		// Quick open service (quick open controller)
		this.quickOpen = this.instantiationService.createInstance(QuickOpenController);
		serviceCollection.set(IQuickOpenService, this.quickOpen);

		// Quick input service
		this.quickInput = this.instantiationService.createInstance(QuickInputService);
		serviceCollection.set(IQuickInputService, this.quickInput);

		// Contributed services
		const contributedServices = getServices();
		for (let contributedService of contributedServices) {
			serviceCollection.set(contributedService.id, contributedService.descriptor);
		}

		// TODO@Alex TODO@Sandeep this should move somewhere else
		this.instantiationService.invokeFunction(accessor => {
			const remoteAgentConnection = accessor.get(IRemoteAgentService).getConnection();
			if (remoteAgentConnection) {
				remoteAgentConnection.registerChannel('dialog', this.instantiationService.createInstance(DialogChannel));
				remoteAgentConnection.registerChannel('download', new DownloadServiceChannel());
				remoteAgentConnection.registerChannel('loglevel', new LogLevelSetterChannel(this.logService));
			}
		});

		// TODO@Sandeep TODO@Martin debt around cyclic dependencies
		this.instantiationService.invokeFunction(accessor => {
			const fileService = accessor.get(IFileService);
			const instantiationService = accessor.get(IInstantiationService);
			const configurationService = accessor.get(IConfigurationService) as any;
			const themeService = accessor.get(IWorkbenchThemeService) as any;

			if (typeof configurationService.acquireFileService === 'function') {
				configurationService.acquireFileService(fileService);
			}

			if (typeof configurationService.acquireInstantiationService === 'function') {
				configurationService.acquireInstantiationService(instantiationService);
			}

			if (typeof themeService.acquireFileService === 'function') {
				themeService.acquireFileService(fileService);
			}
		});
	}

	private startRegistries(): void {
		this.instantiationService.invokeFunction(accessor => {
			Registry.as<IActionBarRegistry>(ActionBarExtensions.Actionbar).start(accessor);
			Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).start(accessor);
			Registry.as<IEditorInputFactoryRegistry>(EditorExtensions.EditorInputFactories).start(accessor);
		});
	}

	private hasInitialFilesToOpen(): boolean {
		return !!(
			(this.configuration.filesToCreate && this.configuration.filesToCreate.length > 0) ||
			(this.configuration.filesToOpen && this.configuration.filesToOpen.length > 0) ||
			(this.configuration.filesToDiff && this.configuration.filesToDiff.length > 0));
	}

	private registerListeners(): void {

		// Storage
		this._register(this.storageService.onWillSaveState(e => this.saveState(e)));

		// Configuration changes
		this._register(this.configurationService.onDidChangeConfiguration(() => this.setFontAliasing()));
	}

	private fontAliasing: 'default' | 'antialiased' | 'none' | 'auto';
	private setFontAliasing() {
		const aliasing = this.configurationService.getValue<'default' | 'antialiased' | 'none' | 'auto'>(Settings.FONT_ALIASING);
		if (this.fontAliasing === aliasing) {
			return;
		}

		this.fontAliasing = aliasing;

		// Remove all
		const fontAliasingValues: (typeof aliasing)[] = ['antialiased', 'none', 'auto'];
		removeClasses(this.workbench, ...fontAliasingValues.map(value => `monaco-font-aliasing-${value}`));

		// Add specific
		if (fontAliasingValues.some(option => option === aliasing)) {
			addClass(this.workbench, `monaco-font-aliasing-${aliasing}`);
		}
	}

	private renderWorkbench(): void {
		if (this.state.sideBar.hidden) {
			addClass(this.workbench, 'nosidebar');
		}

		if (this.state.panel.hidden) {
			addClass(this.workbench, 'nopanel');
		}

		if (this.state.statusBar.hidden) {
			addClass(this.workbench, 'nostatusbar');
		}

		if (this.state.fullscreen) {
			addClass(this.workbench, 'fullscreen');
		}

		// Apply font aliasing
		this.setFontAliasing();

		// Create Parts
		this.createTitlebarPart();
		this.createActivityBarPart();
		this.createSidebarPart();
		this.createEditorPart();
		this.createPanelPart();
		this.createStatusbarPart();

		// Notification Handlers
		this.instantiationService.invokeFunction(accessor => this.createNotificationsHandlers(accessor));

		// Add Workbench to DOM
		this.container.appendChild(this.workbench);
	}

	private createTitlebarPart(): void {
		const titlebarContainer = this.createPart(Identifiers.TITLEBAR_PART, 'contentinfo', 'titlebar');

		this.titlebarPart.create(titlebarContainer);
	}

	private createActivityBarPart(): void {
		const activitybarPartContainer = this.createPart(Identifiers.ACTIVITYBAR_PART, 'navigation', 'activitybar', this.state.sideBar.position === Position.LEFT ? 'left' : 'right');

		this.activitybarPart.create(activitybarPartContainer);
	}

	private createSidebarPart(): void {
		const sidebarPartContainer = this.createPart(Identifiers.SIDEBAR_PART, 'complementary', 'sidebar', this.state.sideBar.position === Position.LEFT ? 'left' : 'right');

		this.sidebarPart.create(sidebarPartContainer);
	}

	private createPanelPart(): void {
		const panelPartContainer = this.createPart(Identifiers.PANEL_PART, 'complementary', 'panel', this.state.panel.position === Position.BOTTOM ? 'bottom' : 'right');

		this.panelPart.create(panelPartContainer);
	}

	private createEditorPart(): void {
		const editorContainer = this.createPart(Identifiers.EDITOR_PART, 'main', 'editor');

		this.editorPart.create(editorContainer);
	}

	private createStatusbarPart(): void {
		const statusbarContainer = this.createPart(Identifiers.STATUSBAR_PART, 'contentinfo', 'statusbar');

		this.statusbarPart.create(statusbarContainer);
	}

	private createPart(id: string, role: string, ...classes: string[]): HTMLElement {
		const part = document.createElement('div');
		addClasses(part, 'part', ...classes);
		part.id = id;
		part.setAttribute('role', role);

		if (!this.configurationService.getValue('workbench.useExperimentalGridLayout')) {
			// Insert all workbench parts at the beginning. Issue #52531
			// This is primarily for the title bar to allow overriding -webkit-app-region
			this.workbench.insertBefore(part, this.workbench.lastChild);
		}

		return part;
	}

	private createNotificationsHandlers(accessor: ServicesAccessor): void {
		const notificationService = accessor.get(INotificationService) as NotificationService;

		// Notifications Center
		this.notificationsCenter = this._register(this.instantiationService.createInstance(NotificationsCenter, this.workbench, notificationService.model));

		// Notifications Toasts
		this.notificationsToasts = this._register(this.instantiationService.createInstance(NotificationsToasts, this.workbench, notificationService.model));

		// Notifications Alerts
		this._register(this.instantiationService.createInstance(NotificationsAlerts, notificationService.model));

		// Notifications Status
		const notificationsStatus = this.instantiationService.createInstance(NotificationsStatus, notificationService.model);

		// Eventing
		this._register(this.notificationsCenter.onDidChangeVisibility(() => {

			// Update status
			notificationsStatus.update(this.notificationsCenter.isVisible);

			// Update toasts
			this.notificationsToasts.update(this.notificationsCenter.isVisible);
		}));

		// Register Commands
		registerNotificationCommands(this.notificationsCenter, this.notificationsToasts);
	}

	private restoreWorkbench(): Promise<void> {
		const restorePromises: Promise<any>[] = [];

		// Restore editors
		mark('willRestoreEditors');
		restorePromises.push(this.editorPart.whenRestored.then(() => {

			function openEditors(editors: IResourceEditor[], editorService: IEditorService) {
				if (editors.length) {
					return editorService.openEditors(editors);
				}

				return Promise.resolve(undefined);
			}

			if (Array.isArray(this.state.editor.editorsToOpen)) {
				return openEditors(this.state.editor.editorsToOpen, this.editorService);
			}

			return this.state.editor.editorsToOpen.then(editors => openEditors(editors, this.editorService));
		}).then(() => mark('didRestoreEditors')));

		// Restore Sidebar
		if (this.state.sideBar.viewletToRestore) {
			mark('willRestoreViewlet');
			restorePromises.push(this.sidebarPart.openViewlet(this.state.sideBar.viewletToRestore)
				.then(viewlet => {
					if (!viewlet) {
						return this.sidebarPart.openViewlet(this.sidebarPart.getDefaultViewletId()); // fallback to default viewlet as needed
					}

					return viewlet;
				})
				.then(() => mark('didRestoreViewlet')));
		}

		// Restore Panel
		if (this.state.panel.panelToRestore) {
			mark('willRestorePanel');
			this.panelPart.openPanel(this.state.panel.panelToRestore);
			mark('didRestorePanel');
		}

		// Restore Zen Mode
		if (this.state.zenMode.restore) {
			this.toggleZenMode(true, true);
		}

		// Restore Editor Center Mode
		if (this.state.editor.restoreCentered) {
			this.centerEditorLayout(true);
		}

		// Emit a warning after 10s if restore does not complete
		const restoreTimeoutHandle = setTimeout(() => this.logService.warn('Workbench did not finish loading in 10 seconds, that might be a problem that should be reported.'), 10000);

		let error: Error;
		return Promise.all(restorePromises)
			.then(() => clearTimeout(restoreTimeoutHandle))
			.catch(err => error = err)
			.finally(() => this.instantiationService.invokeFunction(accessor => this.whenRestored(accessor, error)));

	}

	private whenRestored(accessor: ServicesAccessor, error?: Error): void {
		const lifecycleService = accessor.get(ILifecycleService);

		this.restored = true;

		// Set lifecycle phase to `Restored`
		lifecycleService.phase = LifecyclePhase.Restored;

		// Set lifecycle phase to `Eventually` after a short delay and when
		// idle (min 2.5sec, max 5sec)
		setTimeout(() => {
			this._register(runWhenIdle(() => {
				lifecycleService.phase = LifecyclePhase.Eventually;
			}, 2500));
		}, 2500);

		if (error) {
			onUnexpectedError(error);
		}

		// Telemetry: startup metrics
		mark('didStartWorkbench');
	}

	private saveState(e: IWillSaveStateEvent): void {

		// Font info
		saveFontInfo(this.storageService);
	}

	dispose(): void {
		super.dispose();

		this.disposed = true;
	}

	//#endregion

	//#region IPartService

	private readonly _onTitleBarVisibilityChange: Emitter<void> = this._register(new Emitter<void>());
	get onTitleBarVisibilityChange(): Event<void> { return this._onTitleBarVisibilityChange.event; }

	private readonly _onZenMode: Emitter<boolean> = this._register(new Emitter<boolean>());
	get onZenModeChange(): Event<boolean> { return this._onZenMode.event; }

	private workbenchGrid: Grid<View> | WorkbenchLegacyLayout;

	private titleBarPartView: View;
	private activityBarPartView: View;
	private sideBarPartView: View;
	private panelPartView: View;
	private editorPartView: View;
	private statusBarPartView: View;

	private readonly state = {
		fullscreen: false,

		menuBar: {
			visibility: undefined as MenuBarVisibility,
			toggled: false
		},

		activityBar: {
			hidden: false
		},

		sideBar: {
			hidden: false,
			position: undefined as Position,
			width: 300,
			viewletToRestore: undefined as string
		},

		editor: {
			hidden: false,
			centered: false,
			restoreCentered: false,
			editorsToOpen: undefined as Promise<IResourceEditor[]> | IResourceEditor[]
		},

		panel: {
			hidden: false,
			position: undefined as Position,
			height: 350,
			width: 350,
			panelToRestore: undefined as string
		},

		statusBar: {
			hidden: false
		},

		zenMode: {
			active: false,
			restore: false,
			transitionedToFullScreen: false,
			transitionedToCenteredEditorLayout: false,
			wasSideBarVisible: false,
			wasPanelVisible: false,
			transitionDisposeables: [] as IDisposable[]
		}
	};

	private registerLayoutListeners(): void {

		// Storage
		this._register(this.storageService.onWillSaveState(e => this.saveLayoutState(e)));

		// Restore editor if hidden and it changes
		this._register(this.editorService.onDidVisibleEditorsChange(() => this.setEditorHidden(false)));
		this._register(this.editorPart.onDidActivateGroup(() => this.setEditorHidden(false)));

		// Configuration changes
		this._register(this.configurationService.onDidChangeConfiguration(() => this.doUpdateLayoutConfiguration()));

		// Fullscreen changes
		this._register(onDidChangeFullscreen(() => this.onFullscreenChanged()));

		// Group changes
		this._register(this.editorGroupService.onDidAddGroup(() => this.centerEditorLayout(this.state.editor.centered)));
		this._register(this.editorGroupService.onDidRemoveGroup(() => this.centerEditorLayout(this.state.editor.centered)));

		// Prevent workbench from scrolling #55456
		this._register(addDisposableListener(this.workbench, EventType.SCROLL, () => this.workbench.scrollTop = 0));

		// Menubar visibility changes
		if ((isWindows || isLinux) && getTitleBarStyle(this.configurationService, this.environmentService) === 'custom') {
			this._register(this.titlebarPart.onMenubarVisibilityChange(visible => this.onMenubarToggled(visible)));
		}
	}

	private onMenubarToggled(visible: boolean) {
		if (visible !== this.state.menuBar.toggled) {
			this.state.menuBar.toggled = visible;

			if (this.state.fullscreen && (this.state.menuBar.visibility === 'toggle' || this.state.menuBar.visibility === 'default')) {
				this._onTitleBarVisibilityChange.fire();
				this.layout();
			}
		}
	}

	private onFullscreenChanged(): void {
		this.state.fullscreen = isFullscreen();

		// Apply as CSS class
		if (this.state.fullscreen) {
			addClass(this.workbench, 'fullscreen');
		} else {
			removeClass(this.workbench, 'fullscreen');

			if (this.state.zenMode.transitionedToFullScreen && this.state.zenMode.active) {
				this.toggleZenMode();
			}
		}

		// Changing fullscreen state of the window has an impact on custom title bar visibility, so we need to update
		if (getTitleBarStyle(this.configurationService, this.environmentService) === 'custom') {
			this._onTitleBarVisibilityChange.fire();
			this.layout(); // handle title bar when fullscreen changes
		}
	}

	private doUpdateLayoutConfiguration(skipLayout?: boolean): void {

		// Sidebar position
		const newSidebarPositionValue = this.configurationService.getValue<string>(Settings.SIDEBAR_POSITION);
		const newSidebarPosition = (newSidebarPositionValue === 'right') ? Position.RIGHT : Position.LEFT;
		if (newSidebarPosition !== this.getSideBarPosition()) {
			this.setSideBarPosition(newSidebarPosition);
		}

		// Panel position
		this.updatePanelPosition();

		if (!this.state.zenMode.active) {

			// Statusbar visibility
			const newStatusbarHiddenValue = !this.configurationService.getValue<boolean>(Settings.STATUSBAR_VISIBLE);
			if (newStatusbarHiddenValue !== this.state.statusBar.hidden) {
				this.setStatusBarHidden(newStatusbarHiddenValue, skipLayout);
			}

			// Activitybar visibility
			const newActivityBarHiddenValue = !this.configurationService.getValue<boolean>(Settings.ACTIVITYBAR_VISIBLE);
			if (newActivityBarHiddenValue !== this.state.activityBar.hidden) {
				this.setActivityBarHidden(newActivityBarHiddenValue, skipLayout);
			}
		}

		// Menubar visibility
		const newMenubarVisibility = this.configurationService.getValue<MenuBarVisibility>(Settings.MENUBAR_VISIBLE);
		this.setMenubarVisibility(newMenubarVisibility, !!skipLayout);
	}

	private setSideBarPosition(position: Position): void {
		const wasHidden = this.state.sideBar.hidden;

		if (this.state.sideBar.hidden) {
			this.setSideBarHidden(false, true /* Skip Layout */);
		}

		const newPositionValue = (position === Position.LEFT) ? 'left' : 'right';
		const oldPositionValue = (this.state.sideBar.position === Position.LEFT) ? 'left' : 'right';
		this.state.sideBar.position = position;

		// Adjust CSS
		removeClass(this.activitybarPart.getContainer(), oldPositionValue);
		removeClass(this.sidebarPart.getContainer(), oldPositionValue);
		addClass(this.activitybarPart.getContainer(), newPositionValue);
		addClass(this.sidebarPart.getContainer(), newPositionValue);

		// Update Styles
		this.activitybarPart.updateStyles();
		this.sidebarPart.updateStyles();

		// Layout
		if (this.workbenchGrid instanceof Grid) {
			if (!wasHidden) {
				this.state.sideBar.width = this.workbenchGrid.getViewSize(this.sideBarPartView);
			}

			this.workbenchGrid.removeView(this.sideBarPartView);
			this.workbenchGrid.removeView(this.activityBarPartView);

			if (!this.state.panel.hidden && this.state.panel.position === Position.BOTTOM) {
				this.workbenchGrid.removeView(this.panelPartView);
			}

			this.layout();
		} else {
			this.workbenchGrid.layout();
		}
	}

	private initLayoutState(accessor: ServicesAccessor): void {
		const configurationService = accessor.get(IConfigurationService);
		const storageService = accessor.get(IStorageService);
		const lifecycleService = accessor.get(ILifecycleService);
		const contextService = accessor.get(IWorkspaceContextService);
		const environmentService = accessor.get(IEnvironmentService);

		// Fullscreen
		this.state.fullscreen = isFullscreen();

		// Menubar visibility
		this.state.menuBar.visibility = configurationService.getValue<MenuBarVisibility>(Settings.MENUBAR_VISIBLE);

		// Activity bar visibility
		this.state.activityBar.hidden = !configurationService.getValue<string>(Settings.ACTIVITYBAR_VISIBLE);

		// Sidebar visibility
		this.state.sideBar.hidden = storageService.getBoolean(Storage.SIDEBAR_HIDDEN, StorageScope.WORKSPACE, contextService.getWorkbenchState() === WorkbenchState.EMPTY);

		// Sidebar position
		this.state.sideBar.position = (configurationService.getValue<string>(Settings.SIDEBAR_POSITION) === 'right') ? Position.RIGHT : Position.LEFT;

		// Sidebar viewlet
		if (!this.state.sideBar.hidden) {
			const viewletRegistry = Registry.as<ViewletRegistry>(ViewletExtensions.Viewlets);

			// Only restore last viewlet if window was reloaded or we are in development mode
			let viewletToRestore: string;
			if (!environmentService.isBuilt || lifecycleService.startupKind === StartupKind.ReloadedWindow) {
				viewletToRestore = storageService.get(SidebarPart.activeViewletSettingsKey, StorageScope.WORKSPACE, viewletRegistry.getDefaultViewletId());
			} else {
				viewletToRestore = viewletRegistry.getDefaultViewletId();
			}

			if (viewletToRestore) {
				this.state.sideBar.viewletToRestore = viewletToRestore;
			} else {
				this.state.sideBar.hidden = true; // we hide sidebar if there is no viewlet to restore
			}
		}

		// Editor centered layout
		this.state.editor.restoreCentered = storageService.getBoolean(Storage.CENTERED_LAYOUT_ENABLED, StorageScope.WORKSPACE, false);

		// Editors to open
		this.state.editor.editorsToOpen = this.resolveEditorsToOpen(accessor);

		// Panel visibility
		this.state.panel.hidden = storageService.getBoolean(Storage.PANEL_HIDDEN, StorageScope.WORKSPACE, true);

		// Panel position
		this.updatePanelPosition();

		// Panel to restore
		if (!this.state.panel.hidden) {
			const panelRegistry = Registry.as<PanelRegistry>(PanelExtensions.Panels);

			let panelToRestore = storageService.get(PanelPart.activePanelSettingsKey, StorageScope.WORKSPACE, panelRegistry.getDefaultPanelId());
			if (!panelRegistry.hasPanel(panelToRestore)) {
				panelToRestore = panelRegistry.getDefaultPanelId(); // fallback to default if panel is unknown
			}

			if (panelToRestore) {
				this.state.panel.panelToRestore = panelToRestore;
			} else {
				this.state.panel.hidden = true; // we hide panel if there is no panel to restore
			}
		}

		// Statusbar visibility
		this.state.statusBar.hidden = !configurationService.getValue<string>(Settings.STATUSBAR_VISIBLE);

		// Zen mode enablement
		this.state.zenMode.restore = storageService.getBoolean(Storage.ZEN_MODE_ENABLED, StorageScope.WORKSPACE, false) && configurationService.getValue(Settings.ZEN_MODE_RESTORE);
	}

	private resolveEditorsToOpen(accessor: ServicesAccessor): Promise<IResourceEditor[]> | IResourceEditor[] {
		const configuration = accessor.get(IWindowService).getConfiguration();
		const configurationService = accessor.get(IConfigurationService);
		const contextService = accessor.get(IWorkspaceContextService);
		const editorGroupService = accessor.get(IEditorGroupsService);
		const backupFileService = accessor.get(IBackupFileService);

		// Files to open, diff or create
		if (this.hasInitialFilesToOpen()) {

			// Files to diff is exclusive
			const filesToDiff = this.toInputs(configuration.filesToDiff, false);
			if (filesToDiff && filesToDiff.length === 2) {
				return [<IResourceDiffInput>{
					leftResource: filesToDiff[0].resource,
					rightResource: filesToDiff[1].resource,
					options: { pinned: true },
					forceFile: true
				}];
			}

			const filesToCreate = this.toInputs(configuration.filesToCreate, true);
			const filesToOpen = this.toInputs(configuration.filesToOpen, false);

			// Otherwise: Open/Create files
			return [...filesToOpen, ...filesToCreate];
		}

		// Empty workbench
		else if (contextService.getWorkbenchState() === WorkbenchState.EMPTY && configurationService.inspect('workbench.startupEditor').value === 'newUntitledFile') {
			const isEmpty = editorGroupService.count === 1 && editorGroupService.activeGroup.count === 0;
			if (!isEmpty) {
				return []; // do not open any empty untitled file if we restored editors from previous session
			}

			return backupFileService.hasBackups().then(hasBackups => {
				if (hasBackups) {
					return []; // do not open any empty untitled file if we have backups to restore
				}

				return [<IUntitledResourceInput>{}];
			});
		}

		return [];
	}

	private toInputs(paths: IPath[], isNew: boolean): Array<IResourceInput | IUntitledResourceInput> {
		if (!paths || !paths.length) {
			return [];
		}

		return paths.map(p => {
			const resource = p.fileUri;
			let input: IResourceInput | IUntitledResourceInput;
			if (isNew) {
				input = { filePath: resource.fsPath, options: { pinned: true } } as IUntitledResourceInput;
			} else {
				input = { resource, options: { pinned: true }, forceFile: true } as IResourceInput;
			}

			if (!isNew && p.lineNumber) {
				input.options.selection = {
					startLineNumber: p.lineNumber,
					startColumn: p.columnNumber
				};
			}

			return input;
		});
	}

	private updatePanelPosition() {
		const defaultPanelPosition = this.configurationService.getValue<string>(Settings.PANEL_POSITION);
		const panelPosition = this.storageService.get(Storage.PANEL_POSITION, StorageScope.WORKSPACE, defaultPanelPosition);

		this.state.panel.position = (panelPosition === 'right') ? Position.RIGHT : Position.BOTTOM;
	}

	isRestored(): boolean {
		return this.restored;
	}

	hasFocus(part: Parts): boolean {
		const activeElement = document.activeElement;
		if (!activeElement) {
			return false;
		}

		const container = this.getContainer(part);

		return isAncestor(activeElement, container);
	}

	getContainer(part: Parts): HTMLElement | null {
		switch (part) {
			case Parts.TITLEBAR_PART:
				return this.titlebarPart.getContainer();
			case Parts.ACTIVITYBAR_PART:
				return this.activitybarPart.getContainer();
			case Parts.SIDEBAR_PART:
				return this.sidebarPart.getContainer();
			case Parts.PANEL_PART:
				return this.panelPart.getContainer();
			case Parts.EDITOR_PART:
				return this.editorPart.getContainer();
			case Parts.STATUSBAR_PART:
				return this.statusbarPart.getContainer();
		}

		return null;
	}

	isVisible(part: Parts): boolean {
		switch (part) {
			case Parts.TITLEBAR_PART:
				if (getTitleBarStyle(this.configurationService, this.environmentService) === 'native') {
					return false;
				} else if (!this.state.fullscreen) {
					return true;
				} else if (isMacintosh) {
					return false;
				} else if (this.state.menuBar.visibility === 'visible') {
					return true;
				} else if (this.state.menuBar.visibility === 'toggle' || this.state.menuBar.visibility === 'default') {
					return this.state.menuBar.toggled;
				}

				return false;
			case Parts.SIDEBAR_PART:
				return !this.state.sideBar.hidden;
			case Parts.PANEL_PART:
				return !this.state.panel.hidden;
			case Parts.STATUSBAR_PART:
				return !this.state.statusBar.hidden;
			case Parts.ACTIVITYBAR_PART:
				return !this.state.activityBar.hidden;
			case Parts.EDITOR_PART:
				return this.workbenchGrid instanceof Grid ? !this.state.editor.hidden : true;
		}

		return true; // any other part cannot be hidden
	}

	getTitleBarOffset(): number {
		let offset = 0;
		if (this.isVisible(Parts.TITLEBAR_PART)) {
			if (this.workbenchGrid instanceof Grid) {
				offset = this.titlebarPart.maximumHeight;
			} else {
				offset = this.workbenchGrid.partLayoutInfo.titlebar.height;

				if (isMacintosh || this.state.menuBar.visibility === 'hidden') {
					offset /= getZoomFactor();
				}
			}
		}

		return offset;
	}

	getWorkbenchElement(): HTMLElement {
		return this.workbench;
	}

	toggleZenMode(skipLayout?: boolean, restoring = false): void {
		this.state.zenMode.active = !this.state.zenMode.active;
		this.state.zenMode.transitionDisposeables = dispose(this.state.zenMode.transitionDisposeables);

		const setLineNumbers = (lineNumbers: any) => this.editorService.visibleTextEditorWidgets.forEach(editor => editor.updateOptions({ lineNumbers }));

		// Check if zen mode transitioned to full screen and if now we are out of zen mode
		// -> we need to go out of full screen (same goes for the centered editor layout)
		let toggleFullScreen = false;

		// Zen Mode Active
		if (this.state.zenMode.active) {
			const config: {
				fullScreen: boolean;
				centerLayout: boolean;
				hideTabs: boolean;
				hideActivityBar: boolean;
				hideStatusBar: boolean;
				hideLineNumbers: boolean;
			} = this.configurationService.getValue('zenMode');

			toggleFullScreen = !this.state.fullscreen && config.fullScreen;

			this.state.zenMode.transitionedToFullScreen = restoring ? config.fullScreen : toggleFullScreen;
			this.state.zenMode.transitionedToCenteredEditorLayout = !this.isEditorLayoutCentered() && config.centerLayout;
			this.state.zenMode.wasSideBarVisible = this.isVisible(Parts.SIDEBAR_PART);
			this.state.zenMode.wasPanelVisible = this.isVisible(Parts.PANEL_PART);

			this.setPanelHidden(true, true);
			this.setSideBarHidden(true, true);

			if (config.hideActivityBar) {
				this.setActivityBarHidden(true, true);
			}

			if (config.hideStatusBar) {
				this.setStatusBarHidden(true, true);
			}

			if (config.hideLineNumbers) {
				setLineNumbers('off');
				this.state.zenMode.transitionDisposeables.push(this.editorService.onDidVisibleEditorsChange(() => setLineNumbers('off')));
			}

			if (config.hideTabs && this.editorPart.partOptions.showTabs) {
				this.state.zenMode.transitionDisposeables.push(this.editorPart.enforcePartOptions({ showTabs: false }));
			}

			if (config.centerLayout) {
				this.centerEditorLayout(true, true);
			}
		}

		// Zen Mode Inactive
		else {
			if (this.state.zenMode.wasPanelVisible) {
				this.setPanelHidden(false, true);
			}

			if (this.state.zenMode.wasSideBarVisible) {
				this.setSideBarHidden(false, true);
			}

			if (this.state.zenMode.transitionedToCenteredEditorLayout) {
				this.centerEditorLayout(false, true);
			}
			setLineNumbers(this.configurationService.getValue('editor.lineNumbers'));

			// Status bar and activity bar visibility come from settings -> update their visibility.
			this.doUpdateLayoutConfiguration(true);

			this.editorGroupService.activeGroup.focus();

			toggleFullScreen = this.state.zenMode.transitionedToFullScreen && this.state.fullscreen;
		}

		if (!skipLayout) {
			this.layout();
		}

		if (toggleFullScreen) {
			this.windowService.toggleFullScreen();
		}

		// Event
		this._onZenMode.fire(this.state.zenMode.active);
	}

	private setStatusBarHidden(hidden: boolean, skipLayout?: boolean): void {
		this.state.statusBar.hidden = hidden;

		// Adjust CSS
		if (hidden) {
			addClass(this.workbench, 'nostatusbar');
		} else {
			removeClass(this.workbench, 'nostatusbar');
		}

		// Layout
		if (!skipLayout) {
			if (this.workbenchGrid instanceof Grid) {
				this.layout();
			} else {
				this.workbenchGrid.layout();
			}
		}
	}

	private createWorkbenchLayout(): void {
		if (this.configurationService.getValue('workbench.useExperimentalGridLayout')) {

			// Create view wrappers for all parts
			this.titleBarPartView = new View(this.titlebarPart);
			this.sideBarPartView = new View(this.sidebarPart);
			this.activityBarPartView = new View(this.activitybarPart);
			this.editorPartView = new View(this.editorPart);
			this.panelPartView = new View(this.panelPart);
			this.statusBarPartView = new View(this.statusbarPart);

			this.workbenchGrid = new Grid(this.editorPartView, { proportionalLayout: false });

			this.workbench.prepend(this.workbenchGrid.element);
		} else {
			this.workbenchGrid = this.instantiationService.createInstance(
				WorkbenchLegacyLayout,
				this.container,
				this.workbench,
				{
					titlebar: this.titlebarPart,
					activitybar: this.activitybarPart,
					editor: this.editorPart,
					sidebar: this.sidebarPart,
					panel: this.panelPart,
					statusbar: this.statusbarPart,
				},
				this.quickOpen,
				this.quickInput,
				this.notificationsCenter,
				this.notificationsToasts
			);
		}
	}

	layout(options?: ILayoutOptions): void {
		this.contextViewService.layout();

		if (!this.disposed) {
			if (this.workbenchGrid instanceof Grid) {
				const dimensions = getClientArea(this.container);
				position(this.workbench, 0, 0, 0, 0, 'relative');
				size(this.workbench, dimensions.width, dimensions.height);

				// Layout the grid
				this.workbenchGrid.layout(dimensions.width, dimensions.height);

				// Layout non-view ui components
				this.quickInput.layout(dimensions);
				this.quickOpen.layout(dimensions);
				this.notificationsCenter.layout(dimensions);
				this.notificationsToasts.layout(dimensions);

				// Layout Grid
				this.layoutGrid();
			} else {
				this.workbenchGrid.layout(options);
			}
		}
	}

	private layoutGrid(): void {
		if (!(this.workbenchGrid instanceof Grid)) {
			return;
		}

		let panelInGrid = this.workbenchGrid.hasView(this.panelPartView);
		let sidebarInGrid = this.workbenchGrid.hasView(this.sideBarPartView);
		let activityBarInGrid = this.workbenchGrid.hasView(this.activityBarPartView);
		let statusBarInGrid = this.workbenchGrid.hasView(this.statusBarPartView);
		let titlebarInGrid = this.workbenchGrid.hasView(this.titleBarPartView);

		// Add parts to grid
		if (!statusBarInGrid) {
			this.workbenchGrid.addView(this.statusBarPartView, Sizing.Split, this.editorPartView, Direction.Down);
			statusBarInGrid = true;
		}

		if (!titlebarInGrid && getTitleBarStyle(this.configurationService, this.environmentService) === 'custom') {
			this.workbenchGrid.addView(this.titleBarPartView, Sizing.Split, this.editorPartView, Direction.Up);
			titlebarInGrid = true;
		}

		if (!activityBarInGrid) {
			this.workbenchGrid.addView(this.activityBarPartView, Sizing.Split, panelInGrid && this.state.sideBar.position === this.state.panel.position ? this.panelPartView : this.editorPartView, this.state.sideBar.position === Position.RIGHT ? Direction.Right : Direction.Left);
			activityBarInGrid = true;
		}

		if (!sidebarInGrid) {
			this.workbenchGrid.addView(this.sideBarPartView, this.state.sideBar.width !== undefined ? this.state.sideBar.width : Sizing.Split, this.activityBarPartView, this.state.sideBar.position === Position.LEFT ? Direction.Right : Direction.Left);
			sidebarInGrid = true;
		}

		if (!panelInGrid) {
			this.workbenchGrid.addView(this.panelPartView, this.getPanelDimension(this.state.panel.position) !== undefined ? this.getPanelDimension(this.state.panel.position) : Sizing.Split, this.editorPartView, this.state.panel.position === Position.BOTTOM ? Direction.Down : Direction.Right);
			panelInGrid = true;
		}

		// Hide parts
		if (this.state.panel.hidden) {
			this.panelPartView.hide();
		}

		if (this.state.statusBar.hidden) {
			this.statusBarPartView.hide();
		}

		if (!this.isVisible(Parts.TITLEBAR_PART)) {
			this.titleBarPartView.hide();
		}

		if (this.state.activityBar.hidden) {
			this.activityBarPartView.hide();
		}

		if (this.state.sideBar.hidden) {
			this.sideBarPartView.hide();
		}

		if (this.state.editor.hidden) {
			this.editorPartView.hide();
		}

		// Show visible parts
		if (!this.state.editor.hidden) {
			this.editorPartView.show();
		}

		if (!this.state.statusBar.hidden) {
			this.statusBarPartView.show();
		}

		if (this.isVisible(Parts.TITLEBAR_PART)) {
			this.titleBarPartView.show();
		}

		if (!this.state.activityBar.hidden) {
			this.activityBarPartView.show();
		}

		if (!this.state.sideBar.hidden) {
			this.sideBarPartView.show();
		}

		if (!this.state.panel.hidden) {
			this.panelPartView.show();
		}
	}

	private getPanelDimension(position: Position): number | undefined {
		return position === Position.BOTTOM ? this.state.panel.height : this.state.panel.width;
	}

	isEditorLayoutCentered(): boolean {
		return this.state.editor.centered;
	}

	centerEditorLayout(active: boolean, skipLayout?: boolean): void {
		this.state.editor.centered = active;

		this.storageService.store(Storage.CENTERED_LAYOUT_ENABLED, active, StorageScope.WORKSPACE);

		let smartActive = active;
		if (this.editorPart.groups.length > 1 && this.configurationService.getValue('workbench.editor.centeredLayoutAutoResize')) {
			smartActive = false; // Respect the auto resize setting - do not go into centered layout if there is more than 1 group.
		}

		// Enter Centered Editor Layout
		if (this.editorPart.isLayoutCentered() !== smartActive) {
			this.editorPart.centerLayout(smartActive);

			if (!skipLayout) {
				this.layout();
			}
		}
	}

	resizePart(part: Parts, sizeChange: number): void {
		let view: View;
		switch (part) {
			case Parts.SIDEBAR_PART:
				view = this.sideBarPartView;
			case Parts.PANEL_PART:
				view = this.panelPartView;
			case Parts.EDITOR_PART:
				view = this.editorPartView;
				if (this.workbenchGrid instanceof Grid) {
					this.workbenchGrid.resizeView(view, this.workbenchGrid.getViewSize(view) + sizeChange);
				} else {
					this.workbenchGrid.resizePart(part, sizeChange);
				}
				break;
			default:
				return; // Cannot resize other parts
		}
	}

	setActivityBarHidden(hidden: boolean, skipLayout?: boolean): void {
		this.state.activityBar.hidden = hidden;

		// Layout
		if (!skipLayout) {
			if (this.workbenchGrid instanceof Grid) {
				this.layout();
			} else {
				this.workbenchGrid.layout();
			}
		}
	}

	setEditorHidden(hidden: boolean, skipLayout?: boolean): void {
		if (!(this.workbenchGrid instanceof Grid) || hidden === this.state.editor.hidden) {
			return;
		}

		this.state.editor.hidden = hidden;

		// The editor and the panel cannot be hidden at the same time
		if (this.state.editor.hidden && this.state.panel.hidden) {
			this.setPanelHidden(false, true);
		}

		if (!skipLayout) {
			this.layout();
		}
	}

	setSideBarHidden(hidden: boolean, skipLayout?: boolean): void {
		this.state.sideBar.hidden = hidden;

		// Adjust CSS
		if (hidden) {
			addClass(this.workbench, 'nosidebar');
		} else {
			removeClass(this.workbench, 'nosidebar');
		}

		// If sidebar becomes hidden, also hide the current active Viewlet if any
		if (hidden && this.sidebarPart.getActiveViewlet()) {
			this.sidebarPart.hideActiveViewlet();

			// Pass Focus to Editor or Panel if Sidebar is now hidden
			const activePanel = this.panelPart.getActivePanel();
			if (this.hasFocus(Parts.PANEL_PART) && activePanel) {
				activePanel.focus();
			} else {
				this.editorGroupService.activeGroup.focus();
			}
		}

		// If sidebar becomes visible, show last active Viewlet or default viewlet
		else if (!hidden && !this.sidebarPart.getActiveViewlet()) {
			const viewletToOpen = this.sidebarPart.getLastActiveViewletId();
			if (viewletToOpen) {
				const viewlet = this.sidebarPart.openViewlet(viewletToOpen, true);
				if (!viewlet) {
					this.sidebarPart.openViewlet(this.sidebarPart.getDefaultViewletId(), true);
				}
			}
		}

		// Remember in settings
		const defaultHidden = this.contextService.getWorkbenchState() === WorkbenchState.EMPTY;
		if (hidden !== defaultHidden) {
			this.storageService.store(Storage.SIDEBAR_HIDDEN, hidden ? 'true' : 'false', StorageScope.WORKSPACE);
		} else {
			this.storageService.remove(Storage.SIDEBAR_HIDDEN, StorageScope.WORKSPACE);
		}

		// Layout
		if (!skipLayout) {
			if (this.workbenchGrid instanceof Grid) {
				this.layout();
			} else {
				this.workbenchGrid.layout();
			}
		}
	}

	setPanelHidden(hidden: boolean, skipLayout?: boolean): void {
		this.state.panel.hidden = hidden;

		// Adjust CSS
		if (hidden) {
			addClass(this.workbench, 'nopanel');
		} else {
			removeClass(this.workbench, 'nopanel');
		}

		// If panel part becomes hidden, also hide the current active panel if any
		if (hidden && this.panelPart.getActivePanel()) {
			this.panelPart.hideActivePanel();
			this.editorGroupService.activeGroup.focus(); // Pass focus to editor group if panel part is now hidden
		}

		// If panel part becomes visible, show last active panel or default panel
		else if (!hidden && !this.panelPart.getActivePanel()) {
			const panelToOpen = this.panelPart.getLastActivePanelId();
			if (panelToOpen) {
				const focus = !skipLayout;
				this.panelPart.openPanel(panelToOpen, focus);
			}
		}

		// Remember in settings
		if (!hidden) {
			this.storageService.store(Storage.PANEL_HIDDEN, 'false', StorageScope.WORKSPACE);
		} else {
			this.storageService.remove(Storage.PANEL_HIDDEN, StorageScope.WORKSPACE);
		}

		// The editor and panel cannot be hidden at the same time
		if (hidden && this.state.editor.hidden) {
			this.setEditorHidden(false, true);
		}

		// Layout
		if (!skipLayout) {
			if (this.workbenchGrid instanceof Grid) {
				this.layout();
			} else {
				this.workbenchGrid.layout();
			}
		}
	}

	toggleMaximizedPanel(): void {
		if (this.workbenchGrid instanceof Grid) {
			this.workbenchGrid.maximizeViewSize(this.panelPartView);
		} else {
			this.workbenchGrid.layout({ toggleMaximizedPanel: true, source: Parts.PANEL_PART });
		}
	}

	isPanelMaximized(): boolean {
		if (this.workbenchGrid instanceof Grid) {
			try {
				return this.workbenchGrid.getViewSize2(this.panelPartView).height === this.panelPart.maximumHeight;
			} catch (e) {
				return false;
			}
		} else {
			return this.workbenchGrid.isPanelMaximized();
		}
	}

	getSideBarPosition(): Position {
		return this.state.sideBar.position;
	}

	setMenubarVisibility(visibility: MenuBarVisibility, skipLayout: boolean): void {
		if (this.state.menuBar.visibility !== visibility) {
			this.state.menuBar.visibility = visibility;

			// Layout
			if (!skipLayout) {
				if (this.workbenchGrid instanceof Grid) {
					const dimensions = getClientArea(this.container);
					this.workbenchGrid.layout(dimensions.width, dimensions.height);
				} else {
					this.workbenchGrid.layout();
				}
			}
		}
	}

	getMenubarVisibility(): MenuBarVisibility {
		return this.state.menuBar.visibility;
	}

	getPanelPosition(): Position {
		return this.state.panel.position;
	}

	setPanelPosition(position: Position): void {
		const wasHidden = this.state.panel.hidden;

		if (this.state.panel.hidden) {
			this.setPanelHidden(false, true /* Skip Layout */);
		} else {
			this.savePanelDimension();
		}

		const newPositionValue = (position === Position.BOTTOM) ? 'bottom' : 'right';
		const oldPositionValue = (this.state.panel.position === Position.BOTTOM) ? 'bottom' : 'right';
		this.state.panel.position = position;

		function positionToString(position: Position): string {
			switch (position) {
				case Position.LEFT: return 'left';
				case Position.RIGHT: return 'right';
				case Position.BOTTOM: return 'bottom';
			}
		}

		this.storageService.store(Storage.PANEL_POSITION, positionToString(this.state.panel.position), StorageScope.WORKSPACE);

		// Adjust CSS
		removeClass(this.panelPart.getContainer(), oldPositionValue);
		addClass(this.panelPart.getContainer(), newPositionValue);

		// Update Styles
		this.panelPart.updateStyles();

		// Layout
		if (this.workbenchGrid instanceof Grid) {
			if (!wasHidden) {
				this.savePanelDimension();
			}

			this.workbenchGrid.removeView(this.panelPartView);
			this.layout();
		} else {
			this.workbenchGrid.layout();
		}
	}

	private savePanelDimension(): void {
		if (!(this.workbenchGrid instanceof Grid)) {
			return;
		}

		if (this.state.panel.position === Position.BOTTOM) {
			this.state.panel.height = this.workbenchGrid.getViewSize(this.panelPartView);
		} else {
			this.state.panel.width = this.workbenchGrid.getViewSize(this.panelPartView);
		}
	}

	private saveLayoutState(e: IWillSaveStateEvent): void {

		// Zen Mode
		if (this.state.zenMode.active) {
			this.storageService.store(Storage.ZEN_MODE_ENABLED, true, StorageScope.WORKSPACE);
		} else {
			this.storageService.remove(Storage.ZEN_MODE_ENABLED, StorageScope.WORKSPACE);
		}

		if (e.reason === WillSaveStateReason.SHUTDOWN && this.state.zenMode.active) {
			if (!this.configurationService.getValue(Settings.ZEN_MODE_RESTORE)) {
				this.toggleZenMode(true); // We will not restore zen mode, need to clear all zen mode state changes
			}
		}
	}

	//#endregion
}
