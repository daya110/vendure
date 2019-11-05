import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { DEFAULT_CHANNEL_CODE } from 'shared/shared-constants';
import { notNullOrUndefined } from 'shared/shared-utils';

import { CurrentUserChannel } from '../../../common/generated-types';
import { DataService } from '../../../data/providers/data.service';
import { _ } from '../../providers/i18n/mark-for-extraction';
import { LocalStorageService } from '../../providers/local-storage/local-storage.service';

@Component({
    selector: 'vdr-channel-switcher',
    templateUrl: './channel-switcher.component.html',
    styleUrls: ['./channel-switcher.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChannelSwitcherComponent implements OnInit {
    channels$: Observable<CurrentUserChannel[]>;
    activeChannelCode$: Observable<string>;
    constructor(private dataService: DataService, private localStorageService: LocalStorageService) {}

    ngOnInit() {
        this.channels$ = this.dataService.client.userStatus().mapStream(data => data.userStatus.channels);
        const activeChannel$ = this.dataService.client
            .userStatus()
            .mapStream(data => data.userStatus.channels.find(c => c.id === data.userStatus.activeChannelId))
            .pipe(filter(notNullOrUndefined));
        this.activeChannelCode$ = activeChannel$.pipe(map(channel => channel.code));
    }

    setActiveChannel(channelId: string) {
        this.dataService.client.setActiveChannel(channelId).subscribe(({ setActiveChannel }) => {
            const activeChannel = setActiveChannel.channels.find(c => c.id === channelId);
            if (activeChannel) {
                this.localStorageService.set('activeChannelToken', activeChannel.token);
            }
        });
    }
}
